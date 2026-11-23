import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CalendarFeedService, parseFeedScope } from './calendar-feed.service';
import { CalendarFeedQueryDto } from '../dto/calendar-feed-query.dto';
import {
  CALENDAR_FEED_READ_PER_MINUTE,
  CALENDAR_FEED_ROTATE_PER_MINUTE,
} from '../schedule-sync.constants';
import { perMinute } from '../../common/throttle.util';

// Gestão do link (precisa de sessão). O feed em si é o controller abaixo.
@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar/feed')
export class CalendarFeedManageController {
  constructor(private readonly feedService: CalendarFeedService) {}

  @Get()
  @ApiOperation({
    summary: 'Whether the .ics feed is on, and its secret token.',
  })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.feedService.getStatus(user.id);
  }

  @Post()
  @HttpCode(200)
  @Throttle(perMinute(CALENDAR_FEED_ROTATE_PER_MINUTE))
  @ApiOperation({
    summary:
      'Turns the feed on, or rotates the secret (the old link stops working).',
  })
  enableOrRotate(@CurrentUser() user: AuthenticatedUser) {
    return this.feedService.enableOrRotate(user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Turns the feed off and revokes the link.' })
  disable(@CurrentUser() user: AuthenticatedUser) {
    return this.feedService.disable(user.id);
  }
}

// PÚBLICO de propósito: Google Calendar / Apple / Outlook não enviam cookies.
// O único segredo é o token no URL. Só GET (nunca passa pelo CsrfGuard) e
// só leitura. Sem JwtAuthGuard.
@ApiTags('Calendar')
@Controller('feed')
export class CalendarFeedPublicController {
  constructor(private readonly feedService: CalendarFeedService) {}

  @Get(':file')
  @Throttle(perMinute(CALENDAR_FEED_READ_PER_MINUTE))
  @ApiOperation({
    summary:
      'Read-only .ics feed for calendar subscriptions. :file = <token>.ics',
  })
  async getFeed(
    @Param('file') file: string,
    @Query() query: CalendarFeedQueryDto,
    @Res() res: Response,
  ) {
    const token = file.endsWith('.ics') ? file.slice(0, -4) : file;
    const body = await this.feedService.buildFeedForToken(
      token,
      parseFeedScope(query.only),
    );
    res
      .status(200)
      .set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="productivity-maxing.ics"',
        // privado: o conteúdo é pessoal, e nenhuma cache partilhada o deve guardar.
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
        'Referrer-Policy': 'no-referrer',
      })
      .send(body);
  }
}
