import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AreaTeachersModule } from '../area-teachers/area-teachers.module';
import { ApprovalRulesModule } from '../approval-rules/approval-rules.module';
import { CourseRiskService } from './course-risk.service';
import { CourseRiskController } from './course-risk.controller';

@Module({
  imports: [PrismaModule, AuthModule, AreaTeachersModule, ApprovalRulesModule],
  controllers: [CourseRiskController],
  providers: [CourseRiskService],
})
export class CourseRiskModule {}
