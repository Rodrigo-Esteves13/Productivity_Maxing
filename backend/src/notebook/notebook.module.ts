import { Module } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import { NotebookCollabService } from './notebook-collab.service';
import { NotebookController } from './notebook.controller';
import { NotebookShareController } from './notebook-share.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  controllers: [NotebookController, NotebookShareController],
  providers: [NotebookService, NotebookCollabService],
})
export class NotebookModule {}
