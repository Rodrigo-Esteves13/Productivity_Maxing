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
import { UpdateStudyPlanSettingsDto } from './dto/update-study-plan-settings.dto';
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
  constructor(
    private readonly studyPlanService: StudyPlanService,
    private readonly gradeProjectionService: GradeProjectionService,
  ) {}

  // Mais pesado do que antes (pode treinar o modelo de previsão), por
  // isso tem throttle próprio em vez do default de 100/min.
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Real study time per course: studied so far, typical time per finished task and what is still needed.',
  })
  courses(@CurrentUser() user: AuthenticatedUser) {
    return this.studyPlanService.courses(user.id);
  }

  @Get('grade-projection')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Projects the grade of pending weighted tasks from how study time related to grades in finished ones, with a range. Reports "not enough data" or "no clear link" instead of guessing.',
  })
  gradeProjection(@CurrentUser() user: AuthenticatedUser) {
    return this.gradeProjectionService.project(user.id);
  }

  @Patch('settings')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Updates the daily study limit used by the plan.' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudyPlanSettingsDto,
  ) {
    return this.studyPlanService.updateSettings(user.id, dto);
  }
}
