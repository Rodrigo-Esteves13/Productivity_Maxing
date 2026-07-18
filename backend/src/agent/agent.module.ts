import { Module } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { AgentConfigController } from './agent-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AgentConfigController],
  providers: [AgentConfigService],
})
export class AgentModule {}
