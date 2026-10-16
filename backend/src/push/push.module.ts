import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
