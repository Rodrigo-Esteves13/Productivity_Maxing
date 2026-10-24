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
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Options as MulterOptions } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { ATTACHMENT_MAX_SIZE_BYTES } from '../notebook/attachment-validation.util';
import { TaskAttachmentsService } from './task-attachments.service';

// Ver o mesmo tipo em auth.controller.ts (fieldNestingDepth ainda nao esta
// nos tipos do multer).
type MulterLimitsWithFieldNestingDepth = NonNullable<
  MulterOptions['limits']
> & {
  fieldNestingDepth?: number;
};

const UPLOADS_PER_MINUTE = 10;

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
