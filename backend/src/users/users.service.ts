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
    return this.prisma.user.findUnique({ where: { id } });
  }

  getProviders(id: string) {
    return this.prisma.identity.findMany({ where: { userId: id } });
  }

  getProviderAccount(id: string, provider: AuthProvider) {
    return this.prisma.identity.findFirst({
      where: { userId: id, provider: PROVIDER_MAP[provider] },
    });
  }
}
