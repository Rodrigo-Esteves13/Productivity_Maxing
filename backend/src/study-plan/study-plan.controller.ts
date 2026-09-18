import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StudyPlanService } from './study-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 30;

@ApiTags('Focus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Get()
  @ApiOperation({
    summary:
      'Suggests study session blocks over the next N days, fitting pending tasks into free time (classes, commute and quiet hours already excluded).',
  })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') daysParam?: string,
  ) {
    // Clamp em vez de rejeitar um valor fora do intervalo - um `days=0` ou
    // `days=9999` por engano no cliente não devia ser um 400, só um
    // pedido razoável na mesma (mesma filosofia de "defaults tolerantes"
    // que o resto da app usa em query params opcionais).
    const parsed = Number(daysParam);
    const days = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), MIN_DAYS), MAX_DAYS)
      : DEFAULT_DAYS;

    return this.studyPlanService.generate(user.id, days);
  }
}
