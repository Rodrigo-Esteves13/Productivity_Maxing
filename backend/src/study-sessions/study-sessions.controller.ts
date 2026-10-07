import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StudySessionsService } from './study-sessions.service';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StopStudySessionDto } from './dto/stop-study-session.dto';
import { CreateManualSessionDto } from './dto/create-manual-session.dto';
import { UpdateStudySessionDto } from './dto/update-study-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Focus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study-sessions')
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @Post('start')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartStudySessionDto,
  ) {
    return this.studySessionsService.start(user.id, dto);
  }

  @Post('manual')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createManual(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManualSessionDto,
  ) {
    return this.studySessionsService.createManual(user.id, dto);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const parsed = Number(days);
    return this.studySessionsService.history(
      user.id,
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    );
  }

  @Patch(':id/stop')
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StopStudySessionDto,
  ) {
    return this.studySessionsService.stop(user.id, id, dto);
  }

  // Kept under the normal auth + CSRF guards (no @SkipCsrf here) -
  // unlike TelemetryController's routes, this one DOES mutate a specific
  // user's own session, so the double-submit check stays meaningful.
  // Throttled independently of the global default: a live session pings
  // this once a minute (see HEARTBEAT_INTERVAL_MS in
  // StudySessionProvider.tsx), so 10/min per user is already generous
  // headroom, not a tight limit.
  @Post(':id/heartbeat')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studySessionsService.heartbeat(user.id, id);
  }

  // Sem sessao ativa responde 204 (sem corpo) em vez de 200 com corpo vazio
  // e sem Content-Type: o Firefox tentava ler esse corpo vazio como XML e
  // escrevia "XML Parsing Error: no root element found" na consola.
  @Get('active')
  async getActive(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.studySessionsService.getActive(user.id);
    if (!session) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return session;
  }

  @Get('heatmap')
  getHeatmap(@CurrentUser() user: AuthenticatedUser) {
    return this.studySessionsService.getHeatmap(user.id);
  }

  @Get('time-by-area')
  getTimeByArea(@CurrentUser() user: AuthenticatedUser) {
    return this.studySessionsService.getTimeByArea(user.id);
  }

  @Get('daily-totals')
  getDailyTotals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const parsed = Number(days);
    const safeDays =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 84;
    return this.studySessionsService.getDailyTotals(user.id, safeDays);
  }

  @Get('streak')
  getStreak(@CurrentUser() user: AuthenticatedUser) {
    return this.studySessionsService.getStreak(user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudySessionDto,
  ) {
    return this.studySessionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studySessionsService.remove(user.id, id);
  }
}
