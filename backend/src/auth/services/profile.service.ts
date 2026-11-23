import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isTwoFactorEnabled } from '../../config/app.config';

// Forma ÚNICA do perfil devolvido ao frontend (GET /auth/me, PATCH /auth/me,
// upload/remoção de avatar). Lista explícita de campos: devolver a linha
// inteira do User expunha supabaseAuthId, tokenVersion, o segredo TOTP
// cifrado, os hashes dos códigos de recuperação e o token do feed .ics.
// Tem de ser igual em todas as rotas porque o frontend substitui o user em
// memória pela resposta (derivados como hasPassword/emailVerified incluídos).
const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  // Dashboard ativo (Programa + Período) - o frontend usa isto para
  // saber logo no arranque qual seletor mostrar pré-selecionado, sem
  // precisar de um pedido extra.
  activeProgramId: true,
  activePeriodId: true,
  // Horário/plano de estudo (Fase 6) - ver User.commuteMinutes no
  // schema.prisma. O frontend precisa disto logo no arranque para
  // pré-preencher o CommuteSettingsCard sem um pedido extra.
  commuteMinutes: true,
  commuteMode: true,
  homeAddress: true,
  campusAddress: true,
  quietHoursStart: true,
  quietHoursEnd: true,
  // Só usado para derivar emailVerified abaixo.
  emailVerifiedAt: true,
  deadlineEmailReminders: true,
  deadlinePushReminders: true,
  mutedPushKinds: true,
  spacedReviewsEnabled: true,
  notesPrivateByDefault: true,
  // Só para twoFactorEnabled (o segredo nunca sai do backend).
  twoFactorEnabledAt: true,
  // Só usado para derivar hasPassword abaixo - nunca sai do backend.
  supabaseAuthId: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    const { supabaseAuthId, emailVerifiedAt, twoFactorEnabledAt, ...rest } =
      profile;
    // hasPassword informa o frontend se deve mostrar "Change password" ou
    // "Add password" no EditProfileModal - true só quando já existe uma
    // credencial real no Supabase Auth associada a este User.
    return {
      ...rest,
      hasPassword: !!supabaseAuthId,
      emailVerified: emailVerifiedAt !== null,
      twoFactorAvailable: isTwoFactorEnabled(),
      twoFactorEnabled: twoFactorEnabledAt !== null,
    };
  }
}
