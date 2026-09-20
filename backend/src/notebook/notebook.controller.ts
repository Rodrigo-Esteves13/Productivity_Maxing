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
import type { Options as MulterOptions } from 'multer';
import 'multer';
import { NotebookService } from './notebook.service';
import {
  CreateNotebookEntryDto,
  UpdateNotebookEntryDto,
} from './dto/upsert-notebook-entry.dto';
import { UpsertScheduleLinkDto } from './dto/upsert-schedule-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

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
  constructor(private readonly notebookService: NotebookService) {}

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

  // Mesmos limites/mitigação multer que o upload de avatar (ver
  // AuthController.uploadAvatar): 1 ficheiro, 0 campos extra, profundidade
  // de aninhamento zero.
  @Post('entries/:id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: 8 * 1024 * 1024,
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
