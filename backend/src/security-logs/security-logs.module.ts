import { Module } from '@nestjs/common';
import { SecurityLogsService } from './security-logs.service';
import { SecurityLogsController } from './security-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SecurityLogsController],
  providers: [SecurityLogsService],
  // Exportado para o LoggingThrottlerGuard (registado como APP_GUARD no
  // AppModule) conseguir injetar o serviço e escrever cada bloqueio.
  exports: [SecurityLogsService],
})
export class SecurityLogsModule {}
