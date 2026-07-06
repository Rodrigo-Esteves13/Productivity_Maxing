import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, scryptSync } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { Provider, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import 'multer';
import {
  JwtPayload,
  LinkStatePayload,
} from './interfaces/jwt-payload.interface';

interface OAuthProfileData {
  provider: Provider;
  providerAccountId: string;
  email: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Bucket do Supabase Storage onde ficam as fotos de perfil.
// Tem de existir no projeto Supabase e estar marcado como público
// (Storage -> Buckets -> "avatars" -> Public bucket = ON), para que o
// avatarUrl gerado seja diretamente acessível pelo <img src>.
const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET ?? 'avatars';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: ReturnType<typeof createClient>;
  // Cliente separado com a Service Role Key: só este tem permissão para
  // escrever/apagar no bucket de avatars independentemente das RLS policies
  // (necessário porque nem todos os users passam pelo Supabase Auth -
  // OAuth Google/GitHub/Discord nunca cria sessão Supabase, só o
  // email+password é que passa por lá).
  private readonly storage: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Anon key chega para signUp/signInWithPassword — são os mesmos endpoints
    // públicos que o supabase-js usaria no browser, não operações de admin
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    this.storage = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * Fluxo normal de login/registo via OAuth.
   * Ordem de resolução: Identity existente -> User por email -> criar User novo.
   * (decisão de arquitetura já fixada no projeto)
   */
  async resolveIdentity(data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          accessToken: data.accessToken,
          // o Google só manda refresh_token no primeiro consent; não sobrescrever com undefined
          refreshToken: data.refreshToken ?? existingIdentity.refreshToken,
        },
      });
      return existingIdentity.user;
    }

    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email: data.email,
          name: data.name,
        },
      });
    }

    await this.prisma.identity.create({
      data: {
        userId: user.id,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });

    return user;
  }

  /**
   * Fluxo de "ligar conta": utilizador já autenticado (identificado pelo state
   * assinado, ver createLinkState/consumeLinkState) associa um novo provider
   * ao seu User existente, em vez de criar/procurar por email.
   */
  async linkIdentity(userId: string, data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
    });

    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException(
        'This provider account is already linked to another user.',
      );
    }

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    } else {
      await this.prisma.identity.create({
        data: {
          userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    }

    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  // ---------------- LOGIN/REGISTO POR EMAIL+PASSWORD (via Supabase Auth) ----------------
  // Não guardamos nem validamos passwords aqui — isso é responsabilidade do
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
    const { data: signUpData, error } = await this.supabase.auth.signUp({
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
      // e ainda não houver sessão — o utilizador tem de confirmar antes de entrar.
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
    const { data, error } = await this.supabase.auth.signInWithPassword({
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
   * pelo Supabase — mesma lógica de "find or create by email" já usada no
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

  // ---------------- PERFIL (nome + avatar) ----------------

  async updateProfile(userId: string, data: { name?: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...(data.name !== undefined ? { name: data.name } : {}) },
    });
  }

  /**
   * Faz upload da imagem para o bucket do Supabase Storage e devolve o User
   * já com o novo avatarUrl gravado. Se o user já tinha um avatar antigo
   * (gerido por nós, i.e. dentro do nosso bucket), tenta apagá-lo a seguir
   * para não acumular lixo no bucket.
   */
  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    // Nunca confiar no `file.mimetype`, é o Content-Type que o próprio
    // pedido multipart declara, controlado inteiramente por quem envia o
    // pedido. Detetamos o tipo real a partir dos primeiros bytes do
    // ficheiro (magic bytes), para não guardarmos/servirmos como "imagem"
    // um ficheiro que na realidade é outra coisa qualquer.
    const detected = await fileTypeFromBuffer(file.buffer);
    const detectedMime = detected?.mime;
    const ext = detectedMime ? ALLOWED_MIME_TO_EXT[detectedMime] : undefined;

    if (!ext || !detectedMime) {
      throw new BadRequestException(
        'Unsupported image format. Use PNG, JPG, WEBP or GIF.',
      );
    }

    const previousUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const path = `${userId}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await this.storage.storage
      .from(AVATAR_BUCKET)
      .upload(path, file.buffer, {
        contentType: detectedMime,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(
        'Erro ao fazer upload do avatar para o Supabase',
        uploadError,
      );
      throw new BadRequestException(
        'Could not upload the image. Please try again.',
      );
    }

    const {
      data: { publicUrl },
    } = this.storage.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    });

    // Best-effort: limpar o avatar anterior guardado no nosso bucket.
    // Não bloqueia a resposta nem falha o pedido se der erro.
    this.deleteAvatarFileIfOwned(previousUser.avatarUrl).catch((err) =>
      this.logger.warn(`Não foi possível apagar o avatar antigo: ${err}`),
    );

    return updatedUser;
  }

  /** Remove a foto de perfil atual (volta às iniciais no frontend). */
  async removeAvatar(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.deleteAvatarFileIfOwned(user.avatarUrl);

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
  }

  private async deleteAvatarFileIfOwned(avatarUrl: string | null) {
    if (!avatarUrl) return;

    // Só apagamos ficheiros que vivem no NOSSO bucket (evita tentar apagar
    // avatars vindos do Google/Discord/GitHub, que são URLs externas).
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = avatarUrl.indexOf(marker);
    if (markerIndex === -1) return;

    const path = avatarUrl.slice(markerIndex + marker.length);
    if (!path) return;

    const { error } = await this.storage.storage
      .from(AVATAR_BUCKET)
      .remove([path]);
    if (error) throw error;
  }

  /**
   * Apaga a conta em definitivo: remove o avatar do Storage, a credencial
   * real no Supabase Auth (se for uma conta email+password - contas só-OAuth
   * não têm nenhuma) e o User da BD. O `onDelete: Cascade` no schema.prisma
   * trata de Identity, Task e ApiKey automaticamente - não precisamos de
   * apagar cada tabela à mão aqui.
   *
   * A ordem importa: apagamos o Supabase Auth ANTES do User local. Se
   * fizéssemos ao contrário e o passo do Supabase falhasse a meio, ficava
   * uma conta "fantasma" sem espelho local mas ainda com login válido - o
   * mesmo bug que estamos a corrigir, só que pior (sem nenhum registo local
   * para se perceber que aquilo devia ter sido apagado).
   *
   * Isto é irreversível. O controller é responsável por limpar os cookies
   * de sessão depois de chamar isto.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.supabaseAuthId) {
      const { error } = await this.storage.auth.admin.deleteUser(
        user.supabaseAuthId,
      );
      // "User not found" significa que já não existe do lado do Supabase
      // (ex: apagado manualmente antes) - nesse caso está tudo bem, seguimos
      // para apagar o resto. Qualquer outro erro é abortado, para nunca
      // ficarmos com o User local apagado mas a credencial ainda viva.
      if (error && !/not.*found/i.test(error.message)) {
        throw error;
      }
    }

    await this.deleteAvatarFileIfOwned(user.avatarUrl);

    await this.prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Verifica um JWT vindo do cookie de sessão sem lançar excepção - usado
   * pelo GET /auth/csrf, que precisa de responder 200 tanto para "estás
   * autenticado" como para "não estás", em vez de dar 401 (isso faz o
   * DevTools mostrar um erro vermelho toda vez que a app arranca sem
   * sessão, o que é um estado normal, não um erro).
   */
  verifyAccessTokenCookie(token: string | undefined): JwtPayload | null {
    if (!token) return null;
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  issueJwt(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  /**
   * Token aleatório para o padrão "double submit cookie" do CsrfGuard.
   * Não tem de ser assinado nem verificável - só precisa de ser
   * imprevisível e de bater certo entre o cookie e o header no mesmo pedido.
   */
  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * State assinado e de curta duração, enviado ao provider OAuth no fluxo de
   * "ligar conta". Faz o papel de proteção CSRF: só quem possui um JWT válido
   * do próprio backend consegue gerar um state aceite no callback, e o state
   * expira em 10 minutos.
   */
  createLinkState(userId: string, provider: Provider): string {
    const payload: LinkStatePayload = {
      sub: userId,
      purpose: 'link',
      provider,
    };
    return this.jwtService.sign(payload, { expiresIn: '10m' });
  }

  consumeLinkState(state: string, provider: Provider): string {
    try {
      const payload = this.jwtService.verify<LinkStatePayload>(state);
      if (payload.purpose !== 'link' || payload.provider !== provider) {
        throw new UnauthorizedException(
          'Invalid OAuth state for this provider.',
        );
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state.');
    }
  }

  // GESTÃO DE API KEYS (Para Postman/Scripts externos)

  async generateApiKey(userId: string, name: string) {
    // 32 bytes de entropia pura
    const rawToken = randomBytes(32).toString('base64url');

    // Usamos o secret do servidor como "salt" para manter a segurança do ambiente.
    const secret = process.env.API_KEY_SECRET || 'fallback-secreto-em-dev';

    // 64 é o tamanho do hash em bytes.
    const keyHash = scryptSync(rawToken, secret, 64).toString('hex');

    await this.prisma.apiKey.create({
      data: { userId, keyHash, name },
    });

    this.logger.log(`API Key gerada para o utilizador: ${userId}`);
    return { apiKey: rawToken };
  }

  async validateApiKey(incomingToken: string): Promise<User | null> {
    const secret = process.env.API_KEY_SECRET || 'fallback-secreto-em-dev';

    // Repetimos o scryptSync com os mesmos parâmetros para verificar
    const keyHash = scryptSync(incomingToken, secret, 64).toString('hex');

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (apiKeyRecord) {
      this.prisma.apiKey
        .update({
          where: { id: apiKeyRecord.id },
          data: { lastUsed: new Date() },
        })
        .catch((e) =>
          this.logger.error('Erro ao atualizar lastUsed da API Key', e),
        );

      return apiKeyRecord.user;
    }

    this.logger.warn('Tentativa falhada de uso de API Key.');
    return null;
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.prisma.apiKey.delete({
      where: { id: keyId, userId },
    });
    this.logger.log(`API Key revogada. KeyID: ${keyId}`);
  }
}