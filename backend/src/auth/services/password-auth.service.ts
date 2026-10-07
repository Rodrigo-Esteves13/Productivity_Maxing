import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { getFrontendUrl } from '../../config/app.config';
import { AccountGuardService } from './account-guard.service';
import { SupabaseClientsService } from './supabase-clients.service';

// Mesmo URL usado no AuthController para os redirects de OAuth - usado aqui
// só para o `redirectTo` do email de recuperação de password do Supabase,
// que tem de apontar para uma página nossa (ResetPassword.tsx) capaz de
// completar a sessão de recovery e chamar updateUser({ password }).
const FRONTEND_URL = getFrontendUrl();

@Injectable()
export class PasswordAuthService {
  private readonly logger = new Logger(PasswordAuthService.name);

  constructor(
    private prisma: PrismaService,
    private clients: SupabaseClientsService,
    private mailService: MailService,
    private accountGuard: AccountGuardService,
  ) {}

  // LOGIN/REGISTO POR EMAIL+PASSWORD (via Supabase Auth)
  // Não guardamos nem validamos passwords aqui, isso é responsabilidade do
  // Supabase Auth (auth.users, hashing, etc.). O backend só faz de proxy:
  // 1. Pede ao Supabase para criar/autenticar o utilizador.
  // 2. Sincroniza um User espelho na nossa própria tabela `public.User`
  //    (mesma tabela que já é usada pelo fluxo OAuth), indexado por email.
  // 3. Emite o NOSSO JwtService normal, para que o resto da app (guards,
  //    JwtStrategy, /auth/me, etc.) não precise de saber que o Supabase existe.

  async registerWithPassword(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const { data: signUpData, error } = await this.clients.anon.auth.signUp({
      email: data.email,
      password: data.password,
      options: data.name ? { data: { name: data.name } } : undefined,
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw new UnauthorizedException(error.message);
    }

    if (!signUpData.user) {
      // Acontece se o projeto Supabase tiver confirmação de email obrigatória
      // e ainda não houver sessão, o utilizador tem de confirmar antes de entrar.
      throw new UnauthorizedException(
        'Verifica o teu email para confirmares a conta antes de entrares.',
      );
    }

    this.logger.log(
      `Novo utilizador registado via Supabase: ${signUpData.user.id}`,
    );
    return this.syncLocalUser(data.email, data.name, signUpData.user.id);
  }

  async loginWithPassword(email: string, password: string): Promise<User> {
    const { data, error } = await this.clients.anon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const name =
      (data.user.user_metadata?.name as string | undefined) ?? undefined;
    return this.syncLocalUser(email, name, data.user.id);
  }

  /**
   * Garante que existe um User espelho na nossa BD para o email autenticado
   * pelo Supabase, mesma lógica de "find or create by email" já usada no
   * resolveIdentity() do fluxo OAuth, para os dois caminhos convergirem no
   * mesmo utilizador quando o email coincide.
   *
   * Também grava/atualiza o supabaseAuthId - é isto que o deleteAccount usa
   * depois para conseguir apagar a credencial real, não só o espelho local.
   * O backfill "if (!existing.supabaseAuthId)" cobre os users que já
   * existiam antes deste campo existir.
   */
  private async syncLocalUser(
    email: string,
    name?: string,
    supabaseAuthId?: string,
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Direto à BD (não à cache do AccountStatusService) - login é raro
      // o suficiente para não valer a pena otimizar, e é o momento em
      // que uma suspensão já expirada deve mesmo ser corrigida antes de
      // emitir um novo JWT, não só "tratada como ativa" na próxima leitura.
      this.accountGuard.assertAccountIsUsable(existing);

      if (supabaseAuthId && existing.supabaseAuthId !== supabaseAuthId) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { supabaseAuthId },
        });
      }
      return existing;
    }

    return this.prisma.user.create({
      data: { id: randomUUID(), email, name, supabaseAuthId },
    });
  }

  // RECUPERAÇÃO / DEFINIÇÃO DE PASSWORD

  /**
   * Gera o link de recuperação através da Admin API do Supabase
   * (`generateLink`, que só CRIA o link - nunca envia nada sozinho) e
   * manda-o nós próprios, com o nosso HTML, via MailService/SMTP. Assim
   * evitamos por completo o sistema de emails do Supabase (rate limit de
   * 2/hora sem SMTP próprio, template só editável com SMTP lá configurado,
   * remetente genérico) - o design fica sempre sob o nosso controlo.
   *
   * Resposta sempre genérica no controller, independentemente do
   * resultado aqui - isto evita confirmar a um atacante se um dado email
   * tem conta (email enumeration). generateLink falha para emails que não
   * têm nenhuma credencial no Supabase Auth (contas só-OAuth, ou emails
   * nunca registados) - esse caso é esperado e é ignorado silenciosamente.
   */
  async forgotPassword(email: string): Promise<void> {
    const { data, error } = await this.clients.admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${FRONTEND_URL}/reset-password` },
    });

    if (error || !data.properties?.action_link) {
      if (!/user not found/i.test(error?.message ?? '')) {
        this.logger.error('Erro ao gerar link de reset de password', error);
      }
      return;
    }

    await this.mailService.sendPasswordResetEmail(
      email,
      data.properties.action_link,
    );
  }

  /**
   * Define (ou muda) a password de um utilizador já autenticado pela nossa
   * sessão (JwtAuthGuard) - não pede a password atual, porque a sessão
   * válida já prova a posse da conta.
   *
   * - Se o User já tem supabaseAuthId (já tinha password, ou já tinha
   *   ligado uma antes): atualiza a credencial existente via admin API.
   * - Se não tem (conta criada só por OAuth): cria a credencial no Supabase
   *   Auth agora (admin.createUser, com Service Role Key), e grava o
   *   supabaseAuthId resultante no User local - a partir daqui esta conta
   *   passa a poder entrar por email+password e a usar "Esqueci-me da
   *   password" normalmente.
   */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.supabaseAuthId) {
      const { error } = await this.clients.admin.auth.admin.updateUserById(
        user.supabaseAuthId,
        { password: newPassword },
      );
      if (error) {
        throw new BadRequestException(
          `Could not update password: ${error.message}`,
        );
      }
      return;
    }

    const { data, error } = await this.clients.admin.auth.admin.createUser({
      email: user.email,
      password: newPassword,
      email_confirm: true,
    });

    if (!error && data.user) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { supabaseAuthId: data.user.id },
      });
      return;
    }

    // Dessincronização: já existe uma credencial no Supabase Auth para
    // este email (ex: um registo/teste antigo com password que nunca
    // ficou associado a este User local), por isso o createUser acima
    // rejeitou como duplicado. Em vez de falhar, resolvemos sozinhos:
    // usamos generateLink() só para o Supabase nos devolver o `user.id`
    // correspondente a este email (funciona mesmo sem enviar o link
    // gerado a lado nenhum - só nos interessam os dados do user), gravamos
    // esse supabaseAuthId no User local, e atualizamos a password nele.
    const alreadyRegistered = /already.*registered|already.*exists/i.test(
      error?.message ?? '',
    );

    if (!alreadyRegistered) {
      throw new BadRequestException(
        `Could not create a password for this account: ${error?.message ?? 'unknown error'}`,
      );
    }

    const { data: linkData, error: linkError } =
      await this.clients.admin.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
      });

    if (linkError || !linkData.user) {
      throw new ConflictException(
        'Could not create a password for this account. If you already have a password set up, use "Forgot password" instead.',
      );
    }

    const { error: updateError } =
      await this.clients.admin.auth.admin.updateUserById(linkData.user.id, {
        password: newPassword,
      });

    if (updateError) {
      throw new BadRequestException(
        `Could not update password: ${updateError.message}`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { supabaseAuthId: linkData.user.id },
    });
  }
}
