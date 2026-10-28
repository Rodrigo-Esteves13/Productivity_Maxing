import { NOTEBOOK_PHOTO_MAX_SIZE_BYTES } from '../common/upload-limits';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Options as MulterOptions } from 'multer';
import 'multer';
import { NotebookService } from './notebook.service';
import { ATTACHMENT_MAX_SIZE_BYTES } from './attachment-validation.util';
import {
  CreateNotebookEntryDto,
  UpdateNotebookEntryDto,
} from './dto/upsert-notebook-entry.dto';
import { UpsertScheduleLinkDto } from './dto/upsert-schedule-link.dto';
import { UpdateShareVisibilityDto } from './dto/update-share-visibility.dto';
import { DecideAccessRequestDto } from './dto/decide-access-request.dto';
import { DecideProposalDto } from './dto/decide-proposal.dto';
import { NotebookCollabService } from './notebook-collab.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';

// Mesma mitigação e o mesmo motivo do TS2353 do @types/multer que
// AuthController.uploadAvatar já documenta (GHSA-72gw-mp4g-v24j,
// fieldNestingDepth ainda não está no tipo Options.limits instalado).
type MulterLimitsWithFieldNestingDepth = NonNullable<
  MulterOptions['limits']
> & {
  fieldNestingDepth?: number;
};

@ApiTags('Notebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notebook')
export class NotebookController {
  constructor(
    private readonly notebookService: NotebookService,
    private readonly collabService: NotebookCollabService,
  ) {}

  // Conteudo completo de todas as entradas: o frontend so o pede para
  // exportar a cadeira (a lista usa entry-summaries). Separadores com o
  // frontend antigo ainda o usam para a lista.
  @Get('entries')
  @ApiOperation({
    summary: 'Lists notebook entries for an area, newest first.',
  })
  @ApiQuery({ name: 'areaId', required: true })
  findAllForArea(
    @CurrentUser() user: AuthenticatedUser,
    @Query('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.notebookService.findAllForArea(user.id, areaId);
  }

  // Caminho proprio (e nao entries/summary) para nunca colidir com
  // entries/:id, que so aceita UUIDs.
  @Get('entry-summaries')
  @ApiOperation({
    summary:
      'Lists notebook entries for an area without their content (title, date, text preview, photo and file counts), newest first.',
  })
  @ApiQuery({ name: 'areaId', required: true })
  listSummaries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.notebookService.listSummariesForArea(user.id, areaId);
  }

  // Barato (sem URLs assinados): o editor aberto noutro dispositivo/tab
  // pergunta isto de tempos a tempos e so busca a entrada inteira quando
  // apareceu ou desapareceu uma foto ou anexo.
  @Get('entries/:id/media-ids')
  mediaIds(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.mediaIds(user.id, id);
  }

  @Get('entries/:id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.findOne(user.id, id);
  }

  @Post('entries')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotebookEntryDto,
  ) {
    return this.notebookService.create(user.id, dto);
  }

  @Patch('entries/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotebookEntryDto,
  ) {
    return this.notebookService.update(user.id, id, dto);
  }

  @Delete('entries/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.remove(user.id, id);
  }

  // --- Partilha (link público só de leitura) ----------------------------
  // O endpoint que consome o token (GET /notebook/shared/:token) NÃO vive
  // aqui - fica no NotebookShareController à parte, porque esta classe
  // toda tem @UseGuards(JwtAuthGuard) e um link de partilha é, por
  // definição, para quem não tem sessão nenhuma.
  @Get('entries/:id/share')
  @ApiOperation({
    summary: 'Whether this entry currently has an active share link.',
  })
  getShareStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.getShareStatus(user.id, id);
  }

  @Post('entries/:id/share')
  @ApiOperation({
    summary:
      'Creates (or returns the existing) read-only share link for this entry.',
  })
  createShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.createShare(user.id, id);
  }

  @Delete('entries/:id/share')
  @ApiOperation({
    summary:
      'Stops sharing this entry - the previous link stops working immediately.',
  })
  revokeShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.revokeShare(user.id, id);
  }

  @Patch('entries/:id/share/visibility')
  @ApiOperation({
    summary:
      'Switches an existing share between PUBLIC (link only) and AUTHORIZED (login + owner approval required), without changing the token.',
  })
  updateShareVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShareVisibilityDto,
  ) {
    return this.notebookService.updateShareVisibility(
      user.id,
      id,
      dto.visibility,
    );
  }

  @Get('entries/:id/share/visits')
  @ApiOperation({
    summary: 'Who opened your share link and how many times (owner only).',
  })
  getShareVisits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.getShareVisits(user.id, id);
  }

  // Só faz sentido quando visibility = AUTHORIZED, mas devolve lista vazia
  // (não 400) noutros casos - o painel em NotebookEntryShare.tsx pode
  // pedir isto despreocupadamente sempre que está aberto.
  @Get('entries/:id/share/requests')
  @ApiOperation({
    summary: "Pending/decided access requests for this entry's share link.",
  })
  listAccessRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notebookService.listAccessRequests(user.id, id);
  }

  @Patch('entries/:id/share/requests/:requestId')
  @ApiOperation({ summary: 'Approve or deny a pending access request.' })
  decideAccessRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideAccessRequestDto,
  ) {
    return this.notebookService.decideAccessRequest(
      user.id,
      id,
      requestId,
      dto.decision,
      dto.role,
    );
  }

  @Get('entries/:id/share/proposals')
  @ApiOperation({
    summary: 'Changes proposed by editors, waiting for your approval.',
  })
  listProposals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collabService.listProposals(user.id, id);
  }

  @Patch('entries/:id/share/proposals/:proposalId')
  @ApiOperation({
    summary: 'Approve (applies the changes) or reject an editor proposal.',
  })
  decideProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Body() dto: DecideProposalDto,
  ) {
    return this.collabService.decideProposal(
      user.id,
      id,
      proposalId,
      dto.decision,
    );
  }

  // Mesmos limites/mitigação multer que o upload de avatar (ver
  // AuthController.uploadAvatar): 1 ficheiro, 0 campos extra, profundidade
  // de aninhamento zero.
  // @Throttle dedicado (achado do security audit): sem isto, um upload
  // de ficheiro só tinha o limite global do ThrottlerModule, ao contrário
  // dos endpoints de auth - um endpoint caro em I/O de storage merece o
  // mesmo tratamento.
  @Throttle(perMinute(10))
  @Post('entries/:id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: NOTEBOOK_PHOTO_MAX_SIZE_BYTES,
        files: 1,
        fields: 0,
        fieldNestingDepth: 1,
      } as MulterLimitsWithFieldNestingDepth,
    }),
  )
  addPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was sent (field name must be "photo").',
      );
    }
    return this.notebookService.addPhoto(user.id, id, file);
  }

  @Delete('entries/:id/photos/:photoId')
  removePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.notebookService.removePhoto(user.id, id, photoId);
  }

  // Mesma mitigação multer que addPhoto acima; limite maior (documentos/
  // código pesam mais que uma foto comprimida) e o próprio
  // notebookService valida o tipo real do ficheiro pelos magic bytes
  // (ou, para texto puro, pela ausência de bytes binários) antes de
  // aceitar - ver ATTACHMENT_BINARY_MIME_TO_EXT/ATTACHMENT_TEXT_EXTENSIONS
  // em attachment-validation.util.ts.
  @Throttle(perMinute(10))
  @Post('entries/:id/attachments')
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
  addAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was sent (field name must be "file").',
      );
    }
    return this.notebookService.addAttachment(user.id, id, file);
  }

  @Delete('entries/:id/attachments/:attachmentId')
  removeAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.notebookService.removeAttachment(user.id, id, attachmentId);
  }

  @Get('schedule-links')
  @ApiQuery({ name: 'areaId', required: true })
  findScheduleLink(
    @CurrentUser() user: AuthenticatedUser,
    @Query('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.notebookService.findScheduleLink(user.id, areaId);
  }

  @Post('schedule-links')
  @ApiOperation({
    summary:
      'Links a schedule subject string (as it appears in the imported .ics) to an Area.',
  })
  upsertScheduleLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertScheduleLinkDto,
  ) {
    return this.notebookService.upsertScheduleLink(user.id, dto);
  }

  @Delete('schedule-links/:areaId')
  removeScheduleLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.notebookService.removeScheduleLink(user.id, areaId);
  }

  @Get('detect-class')
  @ApiOperation({
    summary:
      'Returns the ClassOccurrence happening now for this area (if the schedule is linked) and a suggested entry title.',
  })
  @ApiQuery({ name: 'areaId', required: true })
  detectClassNow(
    @CurrentUser() user: AuthenticatedUser,
    @Query('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.notebookService.detectClassNow(user.id, areaId);
  }

  @Get('search')
  @ApiOperation({
    summary:
      "Free-text search across all of the caller's notebook entries - matches title, content, subject name and formatted date (dd/mm/yyyy).",
  })
  @ApiQuery({ name: 'q', required: true })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q: string) {
    return this.notebookService.search(user.id, q ?? '');
  }
}
