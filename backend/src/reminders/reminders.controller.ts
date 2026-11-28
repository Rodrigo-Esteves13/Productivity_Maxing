import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../common/throttle.util';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import { RemindersService } from './reminders.service';
import { CronSecretGuard } from './cron-secret.guard';
import { CRON_REQUESTS_PER_MINUTE } from './reminders.constants';

// Chamado pelo workflow .github/workflows/reminders-cron.yml (de 15 em 15 minutos, por causa dos
// lembretes de medicacao; os de prazos sao idempotentes via SentReminder):
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<api>/internal/reminders/run
// Sem CRON_SECRET configurado a rota "não existe" (404).
@ApiExcludeController()
@Controller('internal/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('run')
  @HttpCode(200)
  @SkipCsrf()
  @Throttle(perMinute(CRON_REQUESTS_PER_MINUTE))
  @UseGuards(CronSecretGuard)
  run() {
    return this.remindersService.run();
  }
}
