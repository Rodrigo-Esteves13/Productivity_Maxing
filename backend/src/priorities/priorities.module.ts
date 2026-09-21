import { Module } from '@nestjs/common';
import { PrioritiesService } from './priorities.service';
import { PrioritiesController } from './priorities.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [PrioritiesController],
  providers: [PrioritiesService],
})
export class PrioritiesModule {}
