import { Module } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { AgentConfigController } from './agent-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';

@Module({
  imports: [PrismaModule, AuthModule, StudySessionsModule],
  controllers: [AgentConfigController],
  providers: [AgentConfigService],
})
export class AgentModule {}
