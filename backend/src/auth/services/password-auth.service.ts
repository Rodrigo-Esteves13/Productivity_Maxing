import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { canPasswordCredentialOpenAccount } from '../password-link.policy';
import {
  EMAIL_NOT_VERIFIED_CODE,
  EmailVerificationService,
} from './email-verification.service';
import { PasswordLinkService } from './password-link.service';
import { runInBackground } from '../../common/background.util';
import { emailEquals, normalizeEmail } from '../email.util';

// Parte local de um email, sem caracteres que mexam no LIKE do Prisma.
const LOGIN_HANDLE_PATTERN = /^[a-z0-9.+-]{1,64}$/i;

// Mesmo URL usado no AuthController para os redirects de OAuth - usado aqui
// só para o `redirectTo` do email de recuperação de password do Supabase,
// que tem de apontar para uma página nossa (ResetPassword.tsx) capaz de
// completar a sessão de recovery e chamar updateUser({ password }).
const FRONTEND_URL = getFrontendUrl();

// Erros do Supabase no registo traduzidos para mensagens nossas. Nunca se
// devolve o error.message do Supabase ao cliente (texto interno, pode mudar
// entre versoes e revelar detalhes da configuracao do projeto).
const SIGNUP_RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again later.';
const SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  weak_password: 'This password is too weak. Use a longer one.',
  email_address_invalid: 'Enter a valid email address.',
  over_email_send_rate_limit: SIGNUP_RATE_LIMIT_MESSAGE,
  over_request_rate_limit: SIGNUP_RATE_LIMIT_MESSAGE,
};
const PASSWORD_UPDATE_FAILED_MESSAGE =
  'Could not update the password. Please try again.';
export const RESET_LINK_INVALID_CODE = 'RESET_LINK_INVALID';
const RESET_LINK_INVALID_MESSAGE =
  'This reset link is invalid or has expired. Request a new one.';
const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Enter your current password.';
const CURRENT_PASSWORD_WRONG_MESSAGE = 'Your current password is incorrect.';
const SIGNUP_FALLBACK_MESSAGE =
  'Could not create the account. Please try again.';
const ACCOUNT_EXISTS_MESSAGE = 'An account with this email already exists.';

// Registo com um email que ja tem conta sem password: nao ha conta nova nem
// sessao, so o email com o link para a juntar (ver PasswordLinkService).
export type RegisterOutcome =
  | { kind: 'created'; user: User }
  | { kind: 'password-link-sent'; email: string };

@Injectable()
export class PasswordAuthService {
  private readonly logger = new Logger(PasswordAuthService.name);

  constructor(
    private prisma: PrismaService,
    private clients: SupabaseClientsService,
    private mailService: MailService,
    private accountGuard: AccountGuardService,
    private emailVerification: EmailVerificationService,
    private passwordLink: PasswordLinkService,
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
  }): Promise<RegisterOutcome> {
    // Registar por password um email que já tem conta NUNCA abre sessão
    // nela, com ou sem REQUIRE_EMAIL_VERIFICATION. Sem isto, syncLocalUser()
    // devolvia essa conta existente e qualquer pessoa entrava na conta de
    // outra só por "se registar" com o email dela (SCR-002, ver
    // password-link.policy.ts).
    // - Conta sem password (Google/GitHub/Discord): manda para a caixa do
    //   dono o link para escolher uma, a mesma conta passa a aceitar os
    //   dois logins. A password deste pedido é descartada.
    // - Conta que já tem password: 409, é só fazer login.
    const existingLocal = await this.prisma.user.findFirst({
      where: { email: emailEquals(data.email) },
      orderBy: { createdAt: 'asc' },
    });
    if (existingLocal) {
      if (!this.passwordLink.canLink(existingLocal)) {
        throw new ConflictException(ACCOUNT_EXISTS_MESSAGE);
      }
      runInBackground(
        this.passwordLink.send(existingLocal),
        this.logger,
        'Password link email',
      );
      return { kind: 'password-link-sent', email: data.email };
    }

    const { data: signUpData, error } = await this.clients.anon.auth.signUp({
      email: data.email,
      password: data.password,
      options: data.name ? { data: { name: data.name } } : undefined,
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw new ConflictException(ACCOUNT_EXISTS_MESSAGE);
      }
      this.logger.warn(`Supabase signUp failed: ${error.code ?? 'no code'}`);
      throw new BadRequestException(
        SIGNUP_ERROR_MESSAGES[error.code ?? ''] ?? SIGNUP_FALLBACK_MESSAGE,
      );
    }

    if (!signUpData.user) {
      // Acontece se o projeto Supabase tiver confirmação de email obrigatória
      // e ainda não houver sessão, o utilizador tem de confirmar antes de entrar.
      throw new UnauthorizedException(
        'Check your email to confirm your account before logging in.',
      );
    }

    this.logger.log(
      `Novo utilizador registado via Supabase: ${signUpData.user.id}`,
    );
    const user = await this.syncLocalUser(
      data.email,
      data.name,
      signUpData.user.id,
    );

    // Verificação LIGADA: envia o link já agora. O controller não abre
    // sessão enquanto o email não estiver verificado (needsEmailVerification).
    // Sem esperar pelo SMTP: um envio lento deixava o registo pendurado e um
    // refresh a meio dava "já existe conta".
    if (this.emailVerification.needsVerification(user)) {
      runInBackground(
        this.emailVerification.sendVerificationEmail(user),
        this.logger,
        'Verification email',
      );
    }
    return { kind: 'created', user };
  }

  /**
   * Pagina do link (POST /auth/password-link): cria a password da conta que
   * ainda nao tinha. Quem clicou provou que o email e seu, por isso o email
   * fica verificado. Nao abre sessao: o login normal a seguir continua a
   * passar pelo 2FA.
   */
  async completePasswordLink(
    token: string,
    password: string,
  ): Promise<{ email: string }> {
    const user = await this.passwordLink.consume(token);
    this.accountGuard.assertAccountIsUsable(user);
    await this.setPassword(user.id, password);
    if (user.emailVerifiedAt === null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    this.logger.log(`Password adicionada por link: user ${user.id}`);
    return { email: user.email };
  }

  /**
   * O login aceita o email ou so a parte antes do @ (ex: "A047610" em vez
   * de "a047610@universidade.pt"). Sem @ so entra se houver exatamente uma
   * conta com esse inicio de email; caso contrario e o mesmo "Invalid
   * credentials." de uma password errada, para nao revelar contas.
   */
  async resolveLoginEmail(identifier: string): Promise<string> {
    if (identifier.includes('@')) return identifier;
    if (!LOGIN_HANDLE_PATTERN.test(identifier)) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    const matches = await this.prisma.user.findMany({
      where: {
        email: { startsWith: `${identifier}@`, mode: 'insensitive' },
      },
      select: { email: true },
      take: 2,
    });
    if (matches.length !== 1) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    return matches[0].email;
  }

  async loginWithPassword(identifier: string, password: string): Promise<User> {
    const email = await this.resolveLoginEmail(identifier);
    const { data, error } = await this.clients.anon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const name =
      (data.user.user_metadata?.name as string | undefined) ?? undefined;
    const user = await this.syncLocalUser(email, name, data.user.id);

    // Password certa mas email por verificar (só acontece com a flag
    // REQUIRE_EMAIL_VERIFICATION ligada). Código estável para o frontend
    // mostrar "verifica o teu email" + botão de reenviar, em vez de um
    // "credenciais inválidas" enganador. Não reenvia sozinho a cada login
    // falhado (isso permitia encher a caixa de correio).
    if (this.emailVerification.needsVerification(user)) {
      throw new ForbiddenException({
        code: EMAIL_NOT_VERIFIED_CODE,
        message: 'Please verify your email before signing in.',
      });
    }
    return user;
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
    // Email sem distinguir maiusculas (E-01): uma conta registada como
    // "Rodrigo@x.pt" tem de abrir com "rodrigo@x.pt". Primeiro pela
    // credencial do Supabase (ligacao exata, cobre duplicados antigos que so
    // diferem nas maiusculas), depois pelo email.
    const existing =
      (supabaseAuthId
        ? await this.prisma.user.findUnique({ where: { supabaseAuthId } })
        : null) ??
      (await this.prisma.user.findFirst({
        where: { email: emailEquals(email) },
        orderBy: { createdAt: 'asc' },
      }));
    if (existing) {
      // Direto à BD (não à cache do AccountStatusService) - login é raro
      // o suficiente para não valer a pena otimizar, e é o momento em
      // que uma suspensão já expirada deve mesmo ser corrigida antes de
      // emitir um novo JWT, não só "tratada como ativa" na próxima leitura.
      this.accountGuard.assertAccountIsUsable(existing);

      // SCR-002: uma credencial do Supabase criada por outra pessoa com este
      // email (ex: signUp direto com a anon key) não abre a conta. Mesma
      // mensagem de uma password errada, para não confirmar nada a ninguém.
      if (supabaseAuthId) {
        const oauthIdentityCount = existing.supabaseAuthId
          ? 0
          : await this.prisma.identity.count({
              where: { userId: existing.id },
            });
        if (
          !canPasswordCredentialOpenAccount(
            existing,
            supabaseAuthId,
            oauthIdentityCount,
          )
        ) {
          this.logger.warn(
            `Password login refused: credential not linked to user ${existing.id}`,
          );
          throw new UnauthorizedException('Invalid credentials.');
        }
      }

      if (supabaseAuthId && existing.supabaseAuthId !== supabaseAuthId) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { supabaseAuthId },
        });
      }
      return existing;
    }

    // Só os registos por password passam por aqui: nascem com
    // emailVerifiedAt = null EXPLÍCITO (o default do schema é `now()`, que
    // só serve para as contas antigas e para OAuth) - ninguém provou ainda
    // que o email é seu. Sem a flag REQUIRE_EMAIL_VERIFICATION isto não
    // bloqueia nada.
    return this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: normalizeEmail(email),
        name,
        supabaseAuthId,
        emailVerifiedAt: null,
      },
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
    // Conta sem password (so-OAuth): o Supabase nao tem nada para recuperar,
    // ou tem uma credencial orfa que nao abre a conta (SCR-002). Manda o
    // nosso link para escolher a password.
    const local = await this.prisma.user.findFirst({
      where: { email: emailEquals(email) },
      orderBy: { createdAt: 'asc' },
    });
    if (local && this.passwordLink.canLink(local)) {
      runInBackground(
        this.passwordLink.send(local),
        this.logger,
        'Password link email',
      );
      return;
    }

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

    runInBackground(
      this.mailService.sendPasswordResetEmail(
        email,
        data.properties.action_link,
      ),
      this.logger,
      'Password reset email',
    );
  }

  /**
   * Fim do "esqueci-me da password" (E-02). Antes, ResetPassword.tsx chamava
   * supabase.auth.updateUser direto do browser e o backend nunca sabia: as
   * sessoes antigas (cookie de 7 dias) continuavam vivas. Agora o browser
   * manda o access token da sessao de recovery; o Supabase valida-o
   * (getUser), a password muda pela admin API e devolvemos o id do User
   * local para o chamador terminar todas as sessoes. So o dono do email
   * consegue esse token (o login por password nunca entrega tokens do
   * Supabase ao browser).
   *
   * Devolve null quando a credencial nao esta ligada a nenhum User local
   * (credencial orfa, SCR-002): a password muda na mesma, nao ha sessoes
   * nossas a terminar.
   */
  async completePasswordReset(
    accessToken: string,
    newPassword: string,
  ): Promise<string | null> {
    const { data, error } = await this.clients.admin.auth.getUser(accessToken);
    if (error || !data.user) {
      // 400 (nao 401): o interceptor do frontend trata 401 como "sessao
      // expirada" e mandava para /login sem mostrar nada.
      throw new BadRequestException({
        code: RESET_LINK_INVALID_CODE,
        message: RESET_LINK_INVALID_MESSAGE,
      });
    }
    const { error: updateError } =
      await this.clients.admin.auth.admin.updateUserById(data.user.id, {
        password: newPassword,
      });
    if (updateError) {
      this.logger.warn(
        `Supabase updateUserById failed on reset: ${updateError.code ?? 'no code'}`,
      );
      throw new BadRequestException(
        SIGNUP_ERROR_MESSAGES[updateError.code ?? ''] ??
          PASSWORD_UPDATE_FAILED_MESSAGE,
      );
    }
    const local = await this.prisma.user.findUnique({
      where: { supabaseAuthId: data.user.id },
      select: { id: true },
    });
    this.logger.log(
      `Password redefinida por recovery: ${local ? `user ${local.id}` : 'sem User local'}`,
    );
    return local?.id ?? null;
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
  // Confirma a password atual pelo próprio Supabase (mesmo caminho do login).
  // Mensagem própria e sem detalhes do Supabase; o throttle da rota (5/min)
  // trava tentativas em série.
  private async assertCurrentPassword(
    email: string,
    currentPassword: string | undefined,
  ): Promise<void> {
    if (!currentPassword) {
      throw new BadRequestException(CURRENT_PASSWORD_REQUIRED_MESSAGE);
    }
    const { error } = await this.clients.anon.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (error) {
      throw new UnauthorizedException(CURRENT_PASSWORD_WRONG_MESSAGE);
    }
  }

  async setPassword(
    userId: string,
    newPassword: string,
    currentPassword?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.supabaseAuthId) {
      // Conta que ja tem password: confirma a atual antes de a trocar.
      await this.assertCurrentPassword(user.email, currentPassword);
      const { error } = await this.clients.admin.auth.admin.updateUserById(
        user.supabaseAuthId,
        { password: newPassword },
      );
      if (error) {
        this.logger.warn(
          `Supabase updateUserById failed: ${error.code ?? 'no code'}`,
        );
        throw new BadRequestException(PASSWORD_UPDATE_FAILED_MESSAGE);
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
      throw new BadRequestException(PASSWORD_UPDATE_FAILED_MESSAGE);
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
      this.logger.warn(
        `Supabase updateUserById failed: ${updateError.code ?? 'no code'}`,
      );
      throw new BadRequestException(PASSWORD_UPDATE_FAILED_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { supabaseAuthId: linkData.user.id },
    });
  }
}
