import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HeartbeatStudySessionDto {
  @ApiPropertyOptional({
    example: '2026-10-05T14:55:00.000Z',
    description:
      'End of the focus block the user planned (countdown / Pomodoro). While inside it (plus a margin), a session that lost contact, e.g. a locked phone, keeps running instead of being auto-stopped. Capped server-side.',
  })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;
}
