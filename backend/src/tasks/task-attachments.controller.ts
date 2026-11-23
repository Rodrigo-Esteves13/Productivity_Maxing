import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  UPLOADS_PER_MINUTE,
  singleFileUpload,
} from '../common/upload-limits';
import { TaskAttachmentsService } from './task-attachments.service';

@ApiTags('Task')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(private readonly attachments: TaskAttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Files of a task, with short-lived download URLs.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.attachments.list(user.id, taskId);
  }

  // Mesmas defesas do upload de anexos do Notebook: tamanho maximo, um so
  // ficheiro, sem campos extra; o tipo real e validado pelo conteudo.
  @Post()
  @Throttle(perMinute(UPLOADS_PER_MINUTE))
  @UseInterceptors(singleFileUpload('file', ATTACHMENT_MAX_SIZE_BYTES))
  @ApiOperation({
    summary:
      'Uploads a file to a task (same types and size as notebook files).',
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was sent (field name must be "file").',
      );
    }
    return this.attachments.upload(user.id, taskId, file);
  }

  @Delete(':attachmentId')
  @ApiOperation({ summary: 'Deletes a file from a task.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.remove(user.id, taskId, attachmentId);
  }
}
