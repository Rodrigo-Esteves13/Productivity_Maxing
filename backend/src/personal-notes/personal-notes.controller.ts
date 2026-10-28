import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { PersonalNotesService } from './personal-notes.service';
import {
  CreatePersonalNoteDto,
  UpdatePersonalNoteDto,
} from './dto/personal-note.dto';
import { PERSONAL_NOTE_WRITES_PER_MINUTE } from './personal-notes.constants';

@ApiTags('Personal notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class PersonalNotesController {
  constructor(private readonly notes: PersonalNotesService) {}

  @Get()
  @ApiOperation({ summary: 'Your personal notes and reminders.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notes.list(user.id);
  }

  @Post()
  @Throttle(perMinute(PERSONAL_NOTE_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Creates a note, optionally with a time to remind you (push).',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePersonalNoteDto,
  ) {
    return this.notes.create(user.id, dto);
  }

  @Patch(':id')
  @Throttle(perMinute(PERSONAL_NOTE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Edits, pins, reschedules or completes a note.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonalNoteDto,
  ) {
    return this.notes.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(PERSONAL_NOTE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a note.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notes.remove(user.id, id);
  }
}
