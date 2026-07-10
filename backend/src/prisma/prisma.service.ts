import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  // Sem isto, o Nest nunca fecha a ligação ao desligar (watch mode local a
  // reiniciar, ou o Render a fazer deploy) - as ligações antigas ficavam
  // penduradas no pooler até expirarem sozinhas por timeout, contribuindo
  // para esgotar o limite de ligações simultâneas do pooler em modo
  // "session". Ver main.ts: app.enableShutdownHooks() é o que garante que
  // este hook é mesmo chamado.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
