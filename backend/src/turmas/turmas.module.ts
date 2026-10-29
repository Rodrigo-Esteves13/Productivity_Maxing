import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotebookModule } from '../notebook/notebook.module';
import { TasksModule } from '../tasks/tasks.module';
import { TurmasController } from './turmas.controller';
import { TurmasService } from './turmas.service';
import { TurmaAccessService } from './turma-access.service';
import { TurmaNotesService } from './turma-notes.service';
import { TurmaFilesService } from './turma-files.service';
import { TurmaAnnouncementsService } from './turma-announcements.service';
import { TurmaLinkedAreasService } from './turma-linked-areas.service';
import { TurmaScheduleService } from './turma-schedule.service';
import { TurmaProgramsService } from './turma-programs.service';
import { TurmaPacksService } from './turma-packs.service';
import { TurmaInvitesService } from './turma-invites.service';
import { TurmaDeadlinesService } from './turma-deadlines.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule, NotebookModule, TasksModule],
  controllers: [TurmasController],
  providers: [
    TurmasService,
    TurmaAccessService,
    TurmaNotesService,
    TurmaFilesService,
    TurmaAnnouncementsService,
    TurmaLinkedAreasService,
    TurmaScheduleService,
    TurmaProgramsService,
    TurmaPacksService,
    TurmaInvitesService,
    TurmaDeadlinesService,
  ],
})
export class TurmasModule {}
