import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GradeComponentsService } from './grade-components.service';
import { GradeComponentsController } from './grade-components.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GradeComponentsController],
  providers: [GradeComponentsService],
})
export class GradeComponentsModule {}
