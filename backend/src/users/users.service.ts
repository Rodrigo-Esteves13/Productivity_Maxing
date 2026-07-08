import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Provider } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

export type AuthProvider = 'google' | 'github' | 'discord';

const PROVIDER_MAP: Record<AuthProvider, Provider> = {
  google: Provider.GOOGLE,
  github: Provider.GITHUB,
  discord: Provider.DISCORD,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    // Reutilizado só para o apagar de contas (deleteAccount já trata do
    // Supabase Auth + Storage + cascade) - evita duplicar essa lógica aqui.
    private authService: AuthService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    // Nunca devolver supabaseAuthId (id interno da credencial no Supabase
    // Auth) nem qualquer outro campo sensível ao cliente, mesmo ao próprio
    // dono - não há necessidade de o frontend o conhecer.
    return this.prisma.user.findUnique({
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
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

    const [tasks, identities, apiKeys] = await Promise.all([
      this.prisma.task.findMany({ where: { userId: id } }),
      this.prisma.identity.findMany({
        where: { userId: id },
        select: { provider: true, createdAt: true },
      }),
      this.prisma.apiKey.findMany({
        where: { userId: id },
        select: { id: true, name: true, createdAt: true, lastUsed: true },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      tasks,
      linkedProviders: identities,
      apiKeys,
    };
  }
}
