import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Provider } from '@prisma/client';

export type AuthProvider = 'google' | 'github' | 'discord';

const PROVIDER_MAP: Record<AuthProvider, Provider> = {
  google: Provider.GOOGLE,
  github: Provider.GITHUB,
  discord: Provider.DISCORD,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
}
