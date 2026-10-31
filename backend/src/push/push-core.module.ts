import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from './push.service';

/**
 * Dono unico do PushService (so precisa do Prisma). Separado do PushModule
 * porque esse importa o AuthModule (o controller usa o JwtAuthGuard) e o
 * AuthModule tambem precisa do push (alerta de novo dispositivo): antes o
 * AuthModule registava o seu proprio PushService para fugir ao ciclo, o que
 * dava DUAS instancias (aviso VAPID duas vezes, e o dedupe em memoria do
 * notifyUserOnce partido em dois, podendo enviar o mesmo aviso duas vezes).
 * Este modulo nao importa nada de auth, por isso nao ha ciclo.
 */
@Module({
  imports: [PrismaModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushCoreModule {}
