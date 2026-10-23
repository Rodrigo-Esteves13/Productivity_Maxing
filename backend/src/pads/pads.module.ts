import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityLogsModule } from '../security-logs/security-logs.module';
import { PadsController } from './pads.controller';
import { PadsService } from './pads.service';

@Module({
  imports: [PrismaModule, AuthModule, SecurityLogsModule],
  controllers: [PadsController],
  providers: [PadsService],
  // RemindersModule apaga os pads expirados no mesmo cron.
  exports: [PadsService],
})
export class PadsModule {}
