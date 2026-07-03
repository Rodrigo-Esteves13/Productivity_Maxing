import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuthProvider = 'google' | 'github' | 'discord';

@Injectable()
export class UsersService {
  //Injetar o Prisma
  constructor(private prisma: PrismaService) {}

  //Devolver os utilizadores reais
  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  getProviders(id: string) {
    return this.prisma.identity.findMany({ where: { userId: id } });
  }

  getProviderAccount(id: string, provider: AuthProvider) {
    // Usamos findFirst porque tem um índice único [provider, providerAccountId], 
    // mas a busca é só por provider e userId
    return this.prisma.identity.findFirst({
      where: { userId: id, provider: provider.toUpperCase() as any }
    });
  }
}