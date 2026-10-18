import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { AuthModule } from '../auth/auth.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
