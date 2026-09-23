import { Module } from '@nestjs/common';
import { AccountStatusService } from './account-status.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AccountStatusService],
  exports: [AccountStatusService],
})
export class AccountStatusModule {}
