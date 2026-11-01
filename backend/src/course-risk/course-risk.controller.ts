import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { CourseRiskService } from './course-risk.service';
import { CourseRiskQueryDto } from './dto/course-risk-query.dto';
import { COURSE_RISK_REQUESTS_PER_MINUTE } from './course-risk.constants';

@ApiTags('Course risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('course-risk')
export class CourseRiskController {
  constructor(private readonly service: CourseRiskService) {}

  @Get()
  @Throttle(perMinute(COURSE_RISK_REQUESTS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Fail risk per course (score, level, reasons), highest score first.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CourseRiskQueryDto,
  ) {
    return this.service.list(user.id, query.absenceLimitPct, query.periodId);
  }

  @Get('overview')
  @Throttle(perMinute(COURSE_RISK_REQUESTS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Fail risk overview: every course (also without enough data), pass chance and summary.',
  })
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CourseRiskQueryDto,
  ) {
    return this.service.overview(
      user.id,
      query.absenceLimitPct,
      query.periodId,
    );
  }
}
