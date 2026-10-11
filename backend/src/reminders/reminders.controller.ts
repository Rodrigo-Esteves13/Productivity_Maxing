import {
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import { RemindersService } from './reminders.service';

function secretsMatch(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamado por um Cron Job do Render de hora a hora:
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<api>/internal/reminders/run
// Sem CRON_SECRET configurado a rota "não existe" (404).
@ApiExcludeController()
@Controller('internal/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('run')
  @HttpCode(200)
  @SkipCsrf()
  @SkipThrottle()
  run(@Headers('x-cron-secret') secret: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    if (!secretsMatch(secret, expected)) throw new UnauthorizedException();
    return this.remindersService.run();
  }
}
