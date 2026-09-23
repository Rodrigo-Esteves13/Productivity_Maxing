import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AccountStatusService } from '../account-status/account-status.service';
import { Provider, UserStatus } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto, BanUserDto } from './dto/update-user-status.dto';

export type AuthProvider = 'google' | 'github' | 'discord';

const PROVIDER_MAP: Record<AuthProvider, Provider> = {
  google: Provider.GOOGLE,
  github: Provider.GITHUB,
  discord: Provider.DISCORD,
};

const USER_ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  status: true,
  suspendedUntil: true,
  statusReason: true,
  statusUpdatedAt: true,
  statusUpdatedBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    // Reutilizado só para o apagar de contas (deleteAccount já trata do
    // Supabase Auth + Storage + cascade) - evita duplicar essa lógica aqui.
    private authService: AuthService,
    // Cache de ban/suspend partilhada com o JwtStrategy - ver o
    // comentário em AccountStatusService sobre porque vive num módulo à
    // parte (evita um ciclo AuthModule <-> UsersModule).
    private accountStatus: AccountStatusService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_ADMIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    // Nunca devolver supabaseAuthId (id interno da credencial no Supabase
    // Auth) nem qualquer outro campo sensível ao cliente, mesmo ao próprio
    // dono - não há necessidade de o frontend o conhecer.
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });
  }

  getProviders(id: string) {
    // accessToken/refreshToken NUNCA saem da BD para uma resposta HTTP,
    // nem para o próprio dono da conta - só expomos o suficiente para a UI
    // mostrar "ligado a X desde Y".
    return this.prisma.identity.findMany({
      where: { userId: id },
      select: { provider: true, createdAt: true },
    });
  }

  getProviderAccount(id: string, provider: AuthProvider) {
    return this.prisma.identity.findFirst({
      where: { userId: id, provider: PROVIDER_MAP[provider] },
      select: { provider: true, createdAt: true },
    });
  }

  /**
   * PATCH /users/:id (ADMIN only, ver users.controller para o guard e a
   * proteção contra auto-lockout). De propósito só aceita name/role - ver
   * o comentário no UpdateUserDto sobre o email ficar de fora.
   */
  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      select: USER_ADMIN_SELECT,
    });
  }

  /**
   * Suspensão temporária (sempre com data de fim) - ADMIN only, guard de
   * auto-ação fica no controller (mesmo padrão de update/remove).
   * `upsert`-like: reaplicar suspendUser a uma conta já suspensa só
   * atualiza a data/motivo, não empilha suspensões.
   */
  async suspendUser(adminId: string, userId: string, dto: SuspendUserDto) {
    const until = new Date(dto.until);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new ConflictException(
        '`until` must be a valid date in the future.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        suspendedUntil: until,
        statusReason: dto.reason,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId: adminId,
      },
      select: USER_ADMIN_SELECT,
    });
    this.accountStatus.markBlocked(userId, UserStatus.SUSPENDED, until);
    return updated;
  }

  /** Banimento permanente - mesmas regras de acesso que suspendUser. */
  async banUser(adminId: string, userId: string, dto: BanUserDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        suspendedUntil: null,
        statusReason: dto.reason,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId: adminId,
      },
      select: USER_ADMIN_SELECT,
    });
    this.accountStatus.markBlocked(userId, UserStatus.BANNED, null);
    return updated;
  }

  /** Levanta um ban ou termina uma suspensão antes do tempo. */
  async reactivateUser(adminId: string, userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        suspendedUntil: null,
        statusReason: null,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId: adminId,
      },
      select: USER_ADMIN_SELECT,
    });
    this.accountStatus.clearBlocked(userId);
    return updated;
  }

  /**
   * DELETE /users/:id (ADMIN only). Reaproveita o AuthService.deleteAccount
   * já usado por DELETE /auth/me, mesma lógica de limpeza (Supabase Auth,
   * avatar no Storage, cascade de Task/Identity/ApiKey), só que a apagar a
   * conta de outra pessoa em vez da própria.
   */
  remove(id: string): Promise<void> {
    return this.authService.deleteAccount(id);
  }

  /**
   * Export "portabilidade dos dados" (GDPR / Privacy Policy): tudo o que a
   * plataforma guarda sobre este utilizador, num único JSON. Usado tanto
   * pelo próprio (self, a partir do Profile) como por um ADMIN a pedido do
   * utilizador, nunca inclui tokens OAuth em claro nem o hash da API Key,
   * só metadados suficientes para a pessoa perceber o que existe.
   *
   * Antes desta versão, faltava tudo o que a pessoa escreveu no Notebook
   * (notas, desenhos, tabelas, links úteis, nomes de ficheiros anexados)
   * e o resto dos dados académicos (Areas, Programs, StudySessions) - o
   * export "de portabilidade" não era, de facto, tudo o que existia sobre
   * o utilizador. Ficheiros em si (fotos/anexos) continuam fora do JSON de
   * propósito (não fazia sentido embutir binários em base64 aqui); só os
   * nomes/metadados dos ficheiros entram, para a pessoa saber o que existe.
   */
  async exportUserData(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    const [
      tasks,
      identities,
      apiKeys,
      academicPrograms,
      studySessions,
      notebookEntries,
    ] = await Promise.all([
      this.prisma.task.findMany({ where: { userId: id } }),
      this.prisma.identity.findMany({
        where: { userId: id },
        select: { provider: true, createdAt: true },
      }),
      this.prisma.apiKey.findMany({
        where: { userId: id },
        select: {
          id: true,
          name: true,
          scope: true,
          createdAt: true,
          lastUsed: true,
        },
      }),
      this.prisma.academicProgram.findMany({ where: { userId: id } }),
      this.prisma.studySession.findMany({ where: { userId: id } }),
      this.prisma.notebookEntry.findMany({
        where: { userId: id },
        include: {
          photos: { select: { id: true, position: true, createdAt: true } },
          attachments: {
            select: {
              id: true,
              originalFileName: true,
              extension: true,
              sizeBytes: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    // Area é um catálogo global (ver AreasService.findAll), não tem
    // userId - não dá para filtrar diretamente. O relevante para o
    // export de dados do utilizador são só as Areas que ele realmente
    // usa (via Task/StudySession/NotebookEntry), nunca o catálogo
    // inteiro (que inclui cadeiras de outros utilizadores).
    const usedAreaIds = new Set<string>([
      ...tasks.map((t) => t.areaId),
      ...studySessions
        .map((s) => s.areaId)
        .filter((areaId): areaId is string => areaId !== null),
      ...notebookEntries.map((n) => n.areaId),
    ]);
    const areas = await this.prisma.area.findMany({
      where: { id: { in: Array.from(usedAreaIds) } },
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      tasks,
      linkedProviders: identities,
      apiKeys,
      areas,
      academicPrograms,
      studySessions,
      notebookEntries,
    };
  }
}
