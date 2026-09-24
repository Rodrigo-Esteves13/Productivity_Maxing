import { Module } from '@nestjs/common';
import { AccountStatusService } from './account-status.service';
import { AccountStatusController } from './account-status.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountStatusController],
  providers: [AccountStatusService],
  exports: [AccountStatusService],
})
export class AccountStatusModule {}
