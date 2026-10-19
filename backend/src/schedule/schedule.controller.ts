import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { EstimateCommuteDto } from './dto/estimate-commute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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
  @Throttle(perMinute(5))
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
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.scheduleService.findRange(
      user.id,
      new Date(from),
      new Date(to),
    );
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
    if (!from || !to || !DATE_KEY.test(from) || !DATE_KEY.test(to)) {
      throw new BadRequestException(
        'Send both "from" and "to" as YYYY-MM-DD, or neither to delete everything.',
      );
    }
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
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
  @Throttle(perMinute(5))
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
