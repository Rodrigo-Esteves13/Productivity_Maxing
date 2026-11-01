import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AccountStatusService } from '../account-status/account-status.service';
import { SessionStateService } from '../account-status/session-state.service';
import { Prisma, Provider, UserStatus } from '@prisma/client';
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
  // O admin procura contas pelo codigo de amigo (ex.: denuncia de spam).
  friendCode: true,
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
    // Papel e versao das sessoes em cache: mudar o papel tem de valer logo.
    private sessionState: SessionStateService,
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
  async update(id: string, dto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      select: USER_ADMIN_SELECT,
    });
    // Despromover (ou promover) tem efeito no pedido seguinte do
    // utilizador, em vez de esperar que o token dele expire.
    if (dto.role !== undefined) this.sessionState.invalidate(id);
    return updated;
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
  // Os campos que "reativar" muda. Fonte unica: reactivateUser() e a
  // aprovacao de appeals (AppealsService, dentro de uma transacao) usam a
  // mesma definicao, por isso nunca divergem.
  buildReactivationData(adminId: string): Prisma.UserUpdateInput {
    return {
      status: UserStatus.ACTIVE,
      suspendedUntil: null,
      statusReason: null,
      statusUpdatedAt: new Date(),
      statusUpdatedBy: { connect: { id: adminId } },
    };
  }

  async reactivateUser(adminId: string, userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: this.buildReactivationData(adminId),
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
        // Definicoes guardadas no perfil (E-09). Nunca segredos (2FA,
        // tokens de feed/sessao, supabaseAuthId).
        status: true,
        suspendedUntil: true,
        statusReason: true,
        emailVerifiedAt: true,
        friendCode: true,
        activeProgramId: true,
        activePeriodId: true,
        commuteMinutes: true,
        commuteMode: true,
        homeAddress: true,
        campusAddress: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        dailyStudyLimitMinutes: true,
        deadlineEmailReminders: true,
        deadlinePushReminders: true,
        spacedReviewsEnabled: true,
        notesPrivateByDefault: true,
        twoFactorEnabledAt: true,
        medicationDisclaimerVersion: true,
        medicationDisclaimerAcceptedAt: true,
        allowEmailFriendRequests: true,
      },
    });

    // E-09: o resto do que esta pessoa criou ou configurou. Segredos de
    // fora (tokens de partilha, chaves de push, codigos de pack so os que
    // ela propria ve na app).
    const [
      workShifts,
      commitments,
      classOccurrences,
      gradeComponents,
      taskPacks,
      friendships,
      blocks,
      notesViewGrants,
      notebookShares,
      feedback,
      appeals,
      agentConfig,
      pushSubscriptions,
      ownedAreas,
      travelTimes,
      scheduleExceptions,
    ] = await Promise.all([
      this.prisma.workShift.findMany({ where: { userId: id } }),
      this.prisma.commitment.findMany({ where: { userId: id } }),
      this.prisma.classOccurrence.findMany({ where: { userId: id } }),
      this.prisma.gradeComponent.findMany({
        where: { userId: id },
        include: { entries: true },
      }),
      this.prisma.taskPack.findMany({
        where: { ownerId: id },
        include: { items: true },
      }),
      this.prisma.friendship.findMany({
        where: { OR: [{ requesterId: id }, { addresseeId: id }] },
      }),
      this.prisma.userBlock.findMany({ where: { blockerId: id } }),
      this.prisma.notebookViewGrant.findMany({
        where: { OR: [{ ownerId: id }, { viewerId: id }] },
      }),
      this.prisma.notebookShare.findMany({
        where: { createdByUserId: id },
        select: {
          id: true,
          notebookEntryId: true,
          visibility: true,
          createdAt: true,
        },
      }),
      this.prisma.feedback.findMany({ where: { userId: id } }),
      this.prisma.userAppeal.findMany({
        where: { userId: id },
        select: {
          id: true,
          statusAtSubmission: true,
          reasonAtSubmission: true,
          message: true,
          createdAt: true,
          resolution: true,
          resolutionNote: true,
          resolvedAt: true,
        },
      }),
      this.prisma.agentConfig.findUnique({ where: { userId: id } }),
      this.prisma.pushSubscription.findMany({
        where: { userId: id },
        select: { id: true, lang: true, createdAt: true },
      }),
      this.prisma.area.findMany({ where: { ownerId: id } }),
      this.prisma.travelTime.findMany({ where: { userId: id } }),
      this.prisma.scheduleException.findMany({ where: { userId: id } }),
    ]);

    const [
      tasks,
      identities,
      apiKeys,
      academicPrograms,
      studySessions,
      notebookEntries,
      moodLogs,
      medications,
      medicationIntakes,
      bloodDonations,
      personalNotes,
      flashcards,
      financeSettings,
      financeEntries,
      financeGoals,
      turmaInvites,
      pads,
      turmaMemberships,
      turmaNotes,
      turmaFiles,
      turmaAnnouncements,
      turmaSharedSubjects,
      turmaSharedPacks,
    ] = await Promise.all([
      // subtasks e anexos (so metadados, sem o caminho no bucket) vão
      // dentro de cada task no export.
      this.prisma.task.findMany({
        where: { userId: id },
        include: {
          subtasks: true,
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
      this.prisma.academicProgram.findMany({
        where: { userId: id },
        include: { periods: true },
      }),
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
      // Bem-estar (dados de saude): tambem e do utilizador, entra no export.
      this.prisma.moodLog.findMany({ where: { userId: id } }),
      this.prisma.medication.findMany({
        where: { userId: id },
        include: { doses: true },
      }),
      // Tomas "se necessario" e registos de alcool.
      this.prisma.medicationIntake.findMany({ where: { userId: id } }),
      this.prisma.bloodDonation.findMany({ where: { userId: id } }),
      this.prisma.personalNote.findMany({ where: { userId: id } }),
      this.prisma.flashcard.findMany({ where: { userId: id } }),
      this.prisma.financeSettings.findUnique({ where: { userId: id } }),
      this.prisma.financeEntry.findMany({ where: { userId: id } }),
      this.prisma.financeGoal.findMany({ where: { userId: id } }),
      // Convites diretos pendentes que recebeu (turma e quem convidou).
      this.prisma.turmaInvite.findMany({
        where: { userId: id },
        select: {
          createdAt: true,
          turma: { select: { id: true, name: true } },
          invitedBy: { select: { name: true } },
        },
      }),
      // Pads e turmas: o que esta pessoa escreveu ou enviou. Pads so os que
      // gravou por ultimo (um pad nao tem dono; o texto e de quem o escreve).
      this.prisma.pad.findMany({
        where: { updatedById: id },
        select: { slug: true, content: true, updatedAt: true },
      }),
      this.prisma.turmaMember.findMany({
        where: { userId: id },
        select: {
          role: true,
          joinedAt: true,
          turma: { select: { id: true, name: true } },
        },
      }),
      this.prisma.turmaNote.findMany({
        where: { createdById: id },
        select: {
          id: true,
          turmaId: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.turmaFile.findMany({
        where: { uploadedById: id },
        select: {
          id: true,
          turmaId: true,
          originalFileName: true,
          extension: true,
          sizeBytes: true,
          createdAt: true,
        },
      }),
      this.prisma.turmaAnnouncement.findMany({
        where: { authorId: id },
        select: {
          id: true,
          turmaId: true,
          title: true,
          body: true,
          createdAt: true,
        },
      }),
      this.prisma.turmaLinkedArea.findMany({
        where: { userId: id },
        select: { turmaId: true, areaId: true, createdAt: true },
      }),
      this.prisma.turmaPack.findMany({
        where: { sharedById: id },
        select: { turmaId: true, packId: true, createdAt: true },
      }),
    ]);

    // N45: nomes de docentes que a pessoa anotou (privados, so dela) e N46:
    // as regras de aprovacao que gravou (por programa ou por cadeira). N48:
    // as avaliacoes pessoais de docente e cadeira.
    const [areaTeacherNotes, areaRatings, approvalRuleSets] = await Promise.all(
      [
        this.prisma.areaTeacherNote.findMany({
          where: { userId: id },
          select: {
            areaId: true,
            teacherName: true,
            autoFromSchedule: true,
            updatedAt: true,
          },
        }),
        this.prisma.areaRating.findMany({
          where: { userId: id },
          select: {
            areaId: true,
            teacherRating: true,
            courseLiking: true,
            updatedAt: true,
          },
        }),
        this.prisma.approvalRuleSet.findMany({
          where: { userId: id },
          select: {
            programId: true,
            areaId: true,
            presetKey: true,
            scaleMin: true,
            scaleMax: true,
            passMark: true,
            rounding: true,
            componentMinGrade: true,
            secondThreshold: true,
            maxBelowSecondThreshold: true,
            customRules: true,
            hasExamTrack: true,
            hasResitTrack: true,
            updatedAt: true,
          },
        }),
      ],
    );

    // Area é um catálogo global (ver AreasService.findAll), não tem
    // userId - não dá para filtrar diretamente. O relevante para o
    // export de dados do utilizador são só as Areas que ele realmente
    // usa (via Task/StudySession/NotebookEntry/nota de docente/regras),
    // nunca o catálogo inteiro (que inclui cadeiras de outros
    // utilizadores).
    const usedAreaIds = new Set<string>([
      ...tasks.map((t) => t.areaId),
      ...studySessions
        .map((s) => s.areaId)
        .filter((areaId): areaId is string => areaId !== null),
      ...notebookEntries.map((n) => n.areaId),
      ...areaTeacherNotes.map((n) => n.areaId),
      ...areaRatings.map((r) => r.areaId),
      ...approvalRuleSets
        .map((r) => r.areaId)
        .filter((areaId): areaId is string => areaId !== null),
    ]);
    // + as Areas privadas que a pessoa criou (Area.ownerId), mesmo sem
    // tasks/sessoes/entradas.
    for (const area of ownedAreas) usedAreaIds.add(area.id);
    const areas = await this.prisma.area.findMany({
      where: { id: { in: Array.from(usedAreaIds) } },
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      areaTeacherNotes,
      areaRatings,
      approvalRuleSets,
      tasks,
      linkedProviders: identities,
      apiKeys,
      areas,
      academicPrograms,
      studySessions,
      notebookEntries,
      moodLogs,
      medications,
      medicationIntakes,
      bloodDonations,
      personalNotes,
      flashcards,
      finance: {
        settings: financeSettings,
        entries: financeEntries,
        goals: financeGoals,
      },
      turmaInvites,
      pads,
      turmas: {
        memberships: turmaMemberships,
        notes: turmaNotes,
        files: turmaFiles,
        announcements: turmaAnnouncements,
        sharedSubjects: turmaSharedSubjects,
        sharedPacks: turmaSharedPacks,
      },
      workShifts,
      commitments,
      scheduleExceptions,
      classOccurrences,
      gradeComponents,
      travelTimes,
      taskPacks,
      social: { friendships, blocks, notesViewGrants },
      notebookShares,
      feedback,
      appeals,
      agentConfig,
      pushSubscriptions,
    };
  }
}
