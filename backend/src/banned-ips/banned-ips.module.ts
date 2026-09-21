import { Module } from '@nestjs/common';
import { BannedIpsService } from './banned-ips.service';
import { BannedIpsController } from './banned-ips.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BannedIpsController],
  providers: [BannedIpsService],
  // BannedIpGuard (common/guards) precisa disto para o check O(1) em
  // memória em todos os pedidos - ver app.module.ts.
  exports: [BannedIpsService],
})
export class BannedIpsModule {}
