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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ScheduleService } from './schedule.service';
import { CreateClassDto, UpdateClassDto } from './dto/class-input.dto';
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { EctsWorkloadQueryDto } from './dto/ects-workload-query.dto';
import { EstimateCommuteDto } from './dto/estimate-commute.dto';
import {
  SetAttendanceDto,
  SetClassCancelledDto,
} from './dto/set-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { isRealDateKey, parseDateKey } from '../common/date-key.util';
import {
  SCHEDULE_COMMUTE_PER_MINUTE,
  SCHEDULE_IMPORT_PER_MINUTE,
} from './schedule.constants';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // O .ics é parseado no cliente (ver utils/parseIcsSchedule.ts no
  // frontend) - o backend só recebe linhas já estruturadas, mesmo padrão
  // do POST /tasks/import. Throttle mais apertado que o default porque
  // isto pode disparar até ~1000 upserts de uma vez (ver
  // ImportScheduleDto), o mesmo cuidado que já existe no import de tasks.
  @Post('import')
  @Throttle(perMinute(SCHEDULE_IMPORT_PER_MINUTE))
  @ApiOperation({
    summary:
      'Bulk-upserts class occurrences parsed client-side from a .ics export. Upserted by [userId, externalUid] - safe to re-run with an overlapping or newer export.',
  })
  importSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportScheduleDto,
  ) {
    return this.scheduleService.importOccurrences(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lists class occurrences between two dates (inclusive).',
  })
  @ApiQuery({ name: 'from', example: '2026-09-14' })
  @ApiQuery({ name: 'to', example: '2026-09-20' })
  findRange(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    // A grelha mostra tambem as aulas desmarcadas (riscadas).
    return this.scheduleService.findRange(
      user.id,
      parseDateKey(query.from),
      parseDateKey(query.to),
      { includeCancelled: true },
    );
  }

  // Literal antes de qualquer rota com :id (mesma regra do resto da app).
  // `to` é cortado em hoje (no service): aulas futuras ainda não têm presença.
  @Get('attendance')
  @ApiOperation({
    summary:
      'Attendance per subject (attended / missed / not marked) for classes between from and to, never past today.',
  })
  @ApiQuery({ name: 'from', example: '2026-09-14' })
  @ApiQuery({ name: 'to', example: '2027-01-31' })
  attendanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.scheduleService.attendanceSummary(
      user.id,
      parseDateKey(query.from),
      parseDateKey(query.to),
    );
  }

  // Literal antes de qualquer rota com :id. Mesmo corte em hoje que
  // /attendance: aulas futuras ainda nao foram dadas.
  @Get('study-vs-class')
  @ApiOperation({
    summary:
      'Study time per course vs class time held between from and to (never past today), plus timetable subjects not linked to a course.',
  })
  @ApiQuery({ name: 'from', example: '2026-09-14' })
  @ApiQuery({ name: 'to', example: '2027-01-31' })
  studyVsClass(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.scheduleService.studyVsClass(
      user.id,
      parseDateKey(query.from),
      parseDateKey(query.to),
    );
  }

  // Literal antes de qualquer rota com :id. `to` e cortado em hoje (Lisboa)
  // no service.
  @Get('ects-workload')
  @ApiOperation({
    summary:
      'Class and study minutes per course with ECTS credits between from and to (never past today), plus timetable subjects not linked to a course.',
  })
  ectsWorkload(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EctsWorkloadQueryDto,
  ) {
    return this.scheduleService.ectsWorkload(
      user.id,
      query.from,
      query.to,
      query.periodId,
    );
  }

  @Patch(':id/attendance')
  @ApiOperation({
    summary:
      'Marks a class as attended (true), missed (false) or not marked (null).',
  })
  setAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAttendanceDto,
  ) {
    return this.scheduleService.setAttendance(user.id, id, dto.attended);
  }

  @Patch(':id/cancelled')
  @ApiOperation({
    summary:
      'Marks a class as cancelled (teacher absent) or back to normal. Cancelled classes keep showing struck through but free the time.',
  })
  setCancelled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetClassCancelledDto,
  ) {
    return this.scheduleService.setCancelled(user.id, id, dto.cancelled);
  }

  // Literal antes das rotas com :id.
  @Post('class')
  @ApiOperation({ summary: 'Creates one class by hand (no .ics needed).' })
  createClass(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClassDto,
  ) {
    return this.scheduleService.createClass(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edits one class (subject, day, time, room).' })
  updateClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.scheduleService.updateClass(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletes one class.' })
  deleteClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.deleteClass(user.id, id);
  }

  // Sem `from`/`to` apaga TODO o horário importado; com os dois só esse
  // intervalo. Recomeçar de zero é o caso principal (importaste o .ics
  // errado) - ver botão "Delete imported classes" no ImportScheduleModal.
  @Delete()
  @ApiOperation({
    summary:
      'Deletes imported class occurrences (all of them, or only between from/to). Does not touch work shifts or notebook entries.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-14' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-20' })
  deleteOccurrences(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from && !to) {
      return this.scheduleService.deleteOccurrences(user.id);
    }
    if (!isRealDateKey(from) || !isRealDateKey(to)) {
      throw new BadRequestException(
        'Send both "from" and "to" as YYYY-MM-DD, or neither to delete everything.',
      );
    }
    const fromDate = parseDateKey(from);
    const toDate = parseDateKey(to);
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('"from" must not be after "to".');
    }
    return this.scheduleService.deleteOccurrences(user.id, {
      from: fromDate,
      to: toDate,
    });
  }

  // Rate-limitado à parte (bem mais apertado que o default de 100/min):
  // cada pedido bate na Google Distance Matrix API, que é paga acima de
  // uma quota gratuita - nada aqui devia permitir um utilizador esgotar
  // essa quota sozinho por engano (ex: duplo-clique).
  @Post('commute/estimate')
  @Throttle(perMinute(SCHEDULE_COMMUTE_PER_MINUTE))
  @ApiOperation({
    summary:
      'Estimates driving time between two addresses via Google Maps and saves homeAddress/campusAddress/commuteMinutes on the user. Returns 503 if GOOGLE_MAPS_API_KEY is not configured on this server.',
  })
  estimateCommute(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EstimateCommuteDto,
  ) {
    return this.scheduleService.estimateCommute(user.id, dto);
  }
}
