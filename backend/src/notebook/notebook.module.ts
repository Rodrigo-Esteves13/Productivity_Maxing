import { Module } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import { NotebookCollabService } from './notebook-collab.service';
import { NotebookSharedWithMeService } from './notebook-shared-with-me.service';
import { NotebookInviteService } from './notebook-invite.service';
import { NotebookInviteController } from './notebook-invite.controller';
import { NotebookViewGrantService } from './notebook-view-grant.service';
import { NotebookViewGrantController } from './notebook-view-grant.controller';
import { SocialModule } from '../social/social.module';
import { NotebookController } from './notebook.controller';
import { NotebookShareController } from './notebook-share.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, AuthModule, PushModule, SocialModule],
  controllers: [
    NotebookController,
    NotebookShareController,
    NotebookViewGrantController,
    NotebookInviteController,
  ],
  providers: [
    NotebookService,
    NotebookCollabService,
    NotebookSharedWithMeService,
    NotebookViewGrantService,
    NotebookInviteService,
  ],
})
export class NotebookModule {}
