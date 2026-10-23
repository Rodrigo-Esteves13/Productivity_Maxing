import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotebookModule } from '../notebook/notebook.module';
import { TurmasController } from './turmas.controller';
import { TurmasService } from './turmas.service';
import { TurmaAccessService } from './turma-access.service';
import { TurmaNotesService } from './turma-notes.service';
import { TurmaFilesService } from './turma-files.service';
import { TurmaAnnouncementsService } from './turma-announcements.service';
import { TurmaLinkedAreasService } from './turma-linked-areas.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule, NotebookModule],
  controllers: [TurmasController],
  providers: [
    TurmasService,
    TurmaAccessService,
    TurmaNotesService,
    TurmaFilesService,
    TurmaAnnouncementsService,
    TurmaLinkedAreasService,
  ],
})
export class TurmasModule {}
