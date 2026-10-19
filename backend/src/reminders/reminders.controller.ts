import {
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../common/throttle.util';

const CRON_REQUESTS_PER_MINUTE = 5;
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
  // Throttle apertado em vez de nenhum: o cron chama de hora a hora, e um
  // limite baixo trava tentativas de adivinhar o CRON_SECRET.
  @Throttle(perMinute(CRON_REQUESTS_PER_MINUTE))
  run(@Headers('x-cron-secret') secret: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    if (!secretsMatch(secret, expected)) throw new UnauthorizedException();
    return this.remindersService.run();
  }
}
