import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import { perMinute } from '../common/throttle.util';
import { MedicationsService } from './medications.service';
import { MedicationDoseActionDto } from './dto/medication.dto';
import { DOSE_ACTION_REQUESTS_PER_MINUTE } from './wellbeing.constants';

/**
 * Botao "Tomei" das notificacoes de medicacao, chamado pelo service worker
 * (public/push-sw.js) sem abrir a app.
 *
 * Fora do WellbeingController de proposito: aquele exige sessao
 * (JwtAuthGuard) e o SW nao tem acesso ao cookie de sessao nem ao token CSRF.
 * Aqui a credencial e o token assinado do proprio push, que so marca UMA
 * toma (ver medication-dose-action.token.ts). @SkipCsrf: o pedido nao usa a
 * sessao por cookie, e sem o token nada acontece, por isso nao ha CSRF a
 * explorar. Rota literal; o WellbeingController nao tem POST medications/:id.
 */
@ApiTags('Wellbeing')
@Controller('wellbeing/medications')
export class MedicationDoseActionController {
  constructor(private readonly medications: MedicationsService) {}

  @Post('dose-action')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(DOSE_ACTION_REQUESTS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Marks the single dose bound to a reminder notification token as taken. Idempotent.',
  })
  takeDose(@Body() dto: MedicationDoseActionDto) {
    return this.medications.takeDoseFromAction(dto.token);
  }
}
