import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StudySessionsService } from './study-sessions.service';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StopStudySessionDto } from './dto/stop-study-session.dto';
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

  @Patch(':id/stop')
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StopStudySessionDto,
  ) {
    return this.studySessionsService.stop(user.id, id, dto);
  }

  @Get('active')
  getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.studySessionsService.getActive(user.id);
  }

  @Get('heatmap')
  getHeatmap(@CurrentUser() user: AuthenticatedUser) {
    return this.studySessionsService.getHeatmap(user.id);
  }
}
