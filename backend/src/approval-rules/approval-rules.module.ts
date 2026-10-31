import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ApprovalRulesService } from './approval-rules.service';
import { ApprovalRulesController } from './approval-rules.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApprovalRulesController],
  providers: [ApprovalRulesService],
  // O endpoint de risco (N47) usa resolveRulesForArea(s).
  exports: [ApprovalRulesService],
})
export class ApprovalRulesModule {}
