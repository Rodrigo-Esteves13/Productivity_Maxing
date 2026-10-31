import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityLogsService } from './security-logs.service';

/**
 * Dono unico do SecurityLogsService (so precisa do Prisma). Separado do
 * SecurityLogsModule porque esse importa o AuthModule (o controller usa os
 * guards de auth) e o AuthModule tambem escreve SecurityLogs (reutilizacao
 * de refresh token): antes o AuthModule registava o seu proprio servico para
 * fugir ao ciclo, o que dava DUAS instancias. Este modulo nao importa nada
 * de auth, por isso nao ha ciclo.
 */
@Module({
  imports: [PrismaModule],
  providers: [SecurityLogsService],
  exports: [SecurityLogsService],
})
export class SecurityLogsCoreModule {}
