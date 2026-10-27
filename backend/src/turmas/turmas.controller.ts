import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Options as MulterOptions } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { ATTACHMENT_MAX_SIZE_BYTES } from '../notebook/attachment-validation.util';
import { TurmasService } from './turmas.service';
import { TurmaNotesService } from './turma-notes.service';
import { TurmaFilesService } from './turma-files.service';
import { TurmaAnnouncementsService } from './turma-announcements.service';
import { TurmaLinkedAreasService } from './turma-linked-areas.service';
import { TurmaPacksService } from './turma-packs.service';
import {
  CreateAnnouncementDto,
  CreateTurmaDto,
  CreateTurmaNoteDto,
  JoinTurmaDto,
  LinkAreaDto,
  SaveTurmaNoteDto,
  SearchTurmaNotesQueryDto,
  SharePackDto,
  TransferDelegadoDto,
  UpdateTurmaDto,
} from './dto/turma.dto';
import {
  JOIN_PER_MINUTE,
  TURMA_NOTE_SAVES_PER_MINUTE,
  TURMA_UPLOADS_PER_MINUTE,
  TURMA_WRITES_PER_MINUTE,
} from './turmas.constants';

// Mesma mitigacao multer do upload de anexos do Notebook (ver
// NotebookController.addAttachment): 1 ficheiro, 0 campos extra.
type MulterLimitsWithFieldNestingDepth = NonNullable<
  MulterOptions['limits']
> & {
  fieldNestingDepth?: number;
};

// Todas as rotas exigem sessao; a pertenca a turma e verificada em cada
// servico (TurmaAccessService), nunca so aqui.
@ApiTags('Turmas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('classes')
export class TurmasController {
  constructor(
    private readonly turmas: TurmasService,
    private readonly notes: TurmaNotesService,
    private readonly files: TurmaFilesService,
    private readonly announcements: TurmaAnnouncementsService,
    private readonly linkedAreas: TurmaLinkedAreasService,
    private readonly packs: TurmaPacksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Turmas you belong to, with your role in each.' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.listMine(user.id);
  }

  @Post()
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Creates a turma. You become its delegado.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTurmaDto) {
    return this.turmas.create(user.id, dto);
  }

  // Rotas literais antes das rotas com :id.
  @Get('search')
  @ApiOperation({
    summary:
      'Searches the notes of every turma you belong to (title and text).',
  })
  searchNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchTurmaNotesQueryDto,
  ) {
    return this.notes.search(user.id, query.q);
  }

  @Post('join')
  @Throttle(perMinute(JOIN_PER_MINUTE))
  @ApiOperation({ summary: 'Joins a turma with its invite code.' })
  join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinTurmaDto) {
    return this.turmas.join(user.id, dto.code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Turma details and members (members only).' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turmas.get(user.id, id);
  }

  @Patch(':id')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Renames the turma or changes its settings (delegado).',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTurmaDto,
  ) {
    return this.turmas.update(user.id, id, dto);
  }

  @Delete(':id')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Deletes the turma with all its content (delegado).',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turmas.remove(user.id, id);
  }

  @Post(':id/invite-code')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Replaces the invite code; the old one stops working (delegado).',
  })
  regenerateInviteCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turmas.regenerateInviteCode(user.id, id);
  }

  @Post(':id/leave')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Leaves the turma. The last member leaving deletes it.',
  })
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turmas.leave(user.id, id);
  }

  @Delete(':id/members/:userId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Removes a member (delegado).' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.turmas.removeMember(user.id, id, targetUserId);
  }

  @Put(':id/representative')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Makes another member the delegado (delegado).' })
  transferDelegado(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferDelegadoDto,
  ) {
    return this.turmas.transferDelegado(user.id, id, dto);
  }

  // Avisos

  @Get(':id/announcements')
  @ApiOperation({ summary: 'Latest announcements (members only).' })
  listAnnouncements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcements.list(user.id, id);
  }

  @Post(':id/announcements')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Posts an announcement and notifies members (delegado).',
  })
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcements.create(user.id, id, dto);
  }

  @Delete(':id/announcements/:announcementId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes an announcement (delegado).' })
  removeAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('announcementId', ParseUUIDPipe) announcementId: string,
  ) {
    return this.announcements.remove(user.id, id, announcementId);
  }

  // Notas da turma

  @Get(':id/notes')
  @ApiOperation({ summary: 'Turma notes, most recently changed first.' })
  listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notes.list(user.id, id);
  }

  @Post(':id/notes')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Creates a turma note.' })
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTurmaNoteDto,
  ) {
    return this.notes.create(user.id, id, dto);
  }

  @Get(':id/notes/:noteId')
  @ApiOperation({ summary: 'One turma note with its text.' })
  getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.notes.get(user.id, id, noteId);
  }

  @Put(':id/notes/:noteId')
  @Throttle(perMinute(TURMA_NOTE_SAVES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Saves a turma note. 409 with the latest note when baseVersion is out of date.',
  })
  saveNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: SaveTurmaNoteDto,
  ) {
    return this.notes.save(user.id, id, noteId, dto);
  }

  @Delete(':id/notes/:noteId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a turma note (delegado or author).' })
  removeNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.notes.remove(user.id, id, noteId);
  }

  // Ficheiros

  @Get(':id/files')
  @ApiOperation({ summary: 'Turma files with short-lived download URLs.' })
  listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.files.list(user.id, id);
  }

  @Post(':id/files')
  @Throttle(perMinute(TURMA_UPLOADS_PER_MINUTE))
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: ATTACHMENT_MAX_SIZE_BYTES,
        files: 1,
        fields: 0,
        fieldNestingDepth: 1,
      } as MulterLimitsWithFieldNestingDepth,
    }),
  )
  @ApiOperation({
    summary: 'Uploads a file (same types and size as notebook files).',
  })
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was sent (field name must be "file").',
      );
    }
    return this.files.upload(user.id, id, file);
  }

  @Delete(':id/files/:fileId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a file (delegado or uploader).' })
  removeFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.files.remove(user.id, id, fileId);
  }

  // Pacotes de tasks partilhados com a turma

  @Get(':id/packs')
  @ApiOperation({ summary: 'Task packs shared with the turma.' })
  listPacks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.packs.list(user.id, id);
  }

  @Post(':id/packs')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Shares one of your task packs with the turma. Members import it like any pack link.',
  })
  sharePack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SharePackDto,
  ) {
    return this.packs.share(user.id, id, dto.packId);
  }

  @Delete(':id/packs/:linkId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Removes a pack from the turma (who shared it or the delegado). The pack itself is kept.',
  })
  unsharePack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.packs.unshare(user.id, id, linkId);
  }

  // Cadeiras do caderno publicadas pelos membros

  @Get(':id/linked-areas')
  @ApiOperation({ summary: 'Notebook subjects members shared with the turma.' })
  listLinkedAreas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.linkedAreas.list(user.id, id);
  }

  @Post(':id/linked-areas')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Shares one of your notebook subjects with the turma (read only, private entries stay hidden).',
  })
  linkArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkAreaDto,
  ) {
    return this.linkedAreas.link(user.id, id, dto.areaId);
  }

  @Delete(':id/linked-areas/:linkId')
  @Throttle(perMinute(TURMA_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Stops sharing a subject (its owner or the delegado).',
  })
  unlinkArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.linkedAreas.unlink(user.id, id, linkId);
  }

  @Get(':id/linked-areas/:linkId/entries')
  @ApiOperation({ summary: 'Entries of a shared subject, newest first.' })
  listLinkedEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.linkedAreas.listEntries(user.id, id, linkId);
  }

  @Get(':id/linked-areas/:linkId/entries/:entryId')
  @ApiOperation({ summary: 'One entry of a shared subject (read only).' })
  getLinkedEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.linkedAreas.getEntry(user.id, id, linkId, entryId);
  }
}
