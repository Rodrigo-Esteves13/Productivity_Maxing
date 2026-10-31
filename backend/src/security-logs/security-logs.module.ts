import { Module } from '@nestjs/common';
import { SecurityLogsController } from './security-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityLogsCoreModule } from './security-logs-core.module';

@Module({
  imports: [PrismaModule, AuthModule, SecurityLogsCoreModule],
  controllers: [SecurityLogsController],
  // Reexporta o SecurityLogsService (instancia unica, do
  // SecurityLogsCoreModule, partilhada com o AuthModule) para o
  // LoggingThrottlerGuard (registado como APP_GUARD no AppModule)
  // conseguir injetar o serviço e escrever cada bloqueio.
  exports: [SecurityLogsCoreModule],
})
export class SecurityLogsModule {}
