import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { AreaRatingsService } from './area-ratings.service';
import { AreaRatingsStatsService } from './area-ratings-stats.service';
import { SetAreaRatingDto } from './dto/set-area-rating.dto';
import { AreaRatingStatsQueryDto } from './dto/area-rating-stats-query.dto';
import {
  AREA_RATING_STATS_REQUESTS_PER_MINUTE,
  AREA_RATING_WRITES_PER_MINUTE,
} from './area-ratings.constants';
import type { AreaRating, RatingStats } from './area-ratings.types';

// Privado ao aluno: so devolve/escreve linhas do proprio user.
@ApiTags('Area ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('area-ratings')
export class AreaRatingsController {
  constructor(
    private readonly service: AreaRatingsService,
    private readonly statsService: AreaRatingsStatsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Your private teacher and course ratings.' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<AreaRating[]> {
    return this.service.list(user.id);
  }

  // Rota literal: declarada antes das rotas :areaId.
  @Get('stats')
  @Throttle(perMinute(AREA_RATING_STATS_REQUESTS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Your ratings against your grades, focus and study time, per course.',
  })
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AreaRatingStatsQueryDto,
  ): Promise<RatingStats> {
    return this.statsService.stats(user.id, query.periodId);
  }

  @Put(':areaId')
  @Throttle(perMinute(AREA_RATING_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Sets your teacher rating and/or course liking (1-5 or null).',
  })
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: SetAreaRatingDto,
  ): Promise<AreaRating> {
    return this.service.set(user.id, areaId, dto);
  }

  @Delete(':areaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(AREA_RATING_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Clears both ratings for a course.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<void> {
    await this.service.remove(user.id, areaId);
  }
}
