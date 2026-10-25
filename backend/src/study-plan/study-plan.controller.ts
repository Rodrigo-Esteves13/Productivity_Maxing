import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StudyPlanService } from './study-plan.service';
import { GradeProjectionService } from './grade-projection.service';
import { PlanScenarioService } from './plan-scenario.service';
import { FocusEffectService } from './focus-effect.service';
import { UpdateStudyPlanSettingsDto } from './dto/update-study-plan-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';

const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 30;

@ApiTags('Focus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study-plan')
export class StudyPlanController {
  constructor(
    private readonly studyPlanService: StudyPlanService,
    private readonly gradeProjectionService: GradeProjectionService,
    private readonly planScenarioService: PlanScenarioService,
    private readonly focusEffectService: FocusEffectService,
  ) {}

  // Mais pesado do que antes (pode treinar o modelo de previsão), por
  // isso tem throttle próprio em vez do default de 100/min.
  @Get()
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Suggests study blocks over the next N days around classes, work shifts, commute and quiet hours, and reports whether the workload fits, needs overtime, or cannot fit.',
  })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') daysParam?: string,
  ) {
    // Clamp em vez de rejeitar: um `days` fora do intervalo não é um 400.
    const parsed = Number(daysParam);
    const days = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), MIN_DAYS), MAX_DAYS)
      : DEFAULT_DAYS;

    return this.studyPlanService.generate(user.id, days);
  }

  @Get('courses')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Real study time per course: studied so far, typical time per finished task and what is still needed.',
  })
  courses(@CurrentUser() user: AuthenticatedUser) {
    return this.studyPlanService.courses(user.id);
  }

  @Get('grade-projection')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Projects the grade of pending weighted tasks from how study time related to grades in finished ones, with a range. Reports "not enough data" or "no clear link" instead of guessing.',
  })
  gradeProjection(@CurrentUser() user: AuthenticatedUser) {
    return this.gradeProjectionService.project(user.id);
  }

  @Get('plan-scenario')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Final grade per course of the active period if you reach your target grade in everything left and follow the study plan, next to the current projection. Behaviour components without a target use the median of your grades.',
  })
  planScenario(@CurrentUser() user: AuthenticatedUser) {
    return this.planScenarioService.build(user.id);
  }

  @Get('focus-effect')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Measures, from your own graded tasks, how much study focus (1 to 5) moves your grade at equal study time. Reports "not enough data" or "inconclusive" instead of guessing.',
  })
  focusEffect(@CurrentUser() user: AuthenticatedUser) {
    return this.focusEffectService.compute(user.id);
  }

  @Get('focus-trend')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Average study focus (1 to 5) and average grade (% of scale) per week, for the last weeks.',
  })
  focusTrend(@CurrentUser() user: AuthenticatedUser) {
    return this.focusEffectService.trend(user.id);
  }

  @Get('focus-scatter')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'One point per graded task: average study focus in the days before the deadline vs the grade.',
  })
  focusScatter(@CurrentUser() user: AuthenticatedUser) {
    return this.focusEffectService.scatter(user.id);
  }

  @Patch('settings')
  @Throttle(perMinute(20))
  @ApiOperation({ summary: 'Updates the daily study limit used by the plan.' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudyPlanSettingsDto,
  ) {
    return this.studyPlanService.updateSettings(user.id, dto);
  }
}
