import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { AuthModule } from '../auth/auth.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { FriendLinksService } from './friend-links.service';
import { FriendCodeRequestsService } from './friend-code-requests.service';
import { FriendCodeRequestsController } from './friend-code-requests.controller';
import { AdminSocialService } from './admin-social.service';
import { AdminSocialController } from './admin-social.controller';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  controllers: [
    SocialController,
    FriendCodeRequestsController,
    AdminSocialController,
  ],
  providers: [
    SocialService,
    FriendLinksService,
    FriendCodeRequestsService,
    AdminSocialService,
  ],
  exports: [SocialService],
})
export class SocialModule {}
