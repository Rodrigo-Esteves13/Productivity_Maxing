import { Injectable } from '@nestjs/common';

export type AuthProvider = 'google' | 'github' | 'discord';

@Injectable()
export class UsersService {
  
  findAll() {
    return `Esta ação devolve todos os utilizadores (Apenas Admin)`;
  }

  findOne(id: string) {
    return `Esta ação devolve o utilizador com o id #${id} via Prisma`;
  }

  getProviders(id: string) {
    return `Esta ação devolve todos os providers do utilizador #${id}`;
  }

  getProviderAccount(id: string, provider: AuthProvider) {
    return `Esta ação vai devolver os dados do provider: ${provider} para o utilizador #${id} (Tabela dos Providers)`;
  }
}