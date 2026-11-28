import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { FEED_SCOPES, type FeedScope } from '../feed/calendar-feed.service';

export class CalendarFeedQueryDto {
  @ApiPropertyOptional({
    enum: FEED_SCOPES,
    description: 'tasks = only task deadlines (no classes, shifts or study).',
  })
  @IsOptional()
  @IsIn(FEED_SCOPES)
  only?: FeedScope;
}
