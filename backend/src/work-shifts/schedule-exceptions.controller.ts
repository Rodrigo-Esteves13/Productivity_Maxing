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
import { ScheduleExceptionsService } from './schedule-exceptions.service';
import { CreateScheduleExceptionDto } from './dto/schedule-exception.dto';
import { perMinute } from '../common/throttle.util';
import { SCHEDULE_EXCEPTION_WRITES_PER_MINUTE } from './work-shifts.constants';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule-exceptions')
export class ScheduleExceptionsController {
  constructor(private readonly service: ScheduleExceptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lists current and recent changes to the weekly schedule.',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id);
  }

  @Post()
  @Throttle(perMinute(SCHEDULE_EXCEPTION_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Skips weekly shifts or moves one to another time between two days (day off, a different week, holidays).',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @Throttle(perMinute(SCHEDULE_EXCEPTION_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Edits a schedule change (takes the whole change, like create).',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Removes a schedule change: the normal schedule applies again.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.id, id);
  }
}
