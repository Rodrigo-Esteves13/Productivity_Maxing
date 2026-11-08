import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MedicationsService } from '../wellbeing/medications.service';

// Variavel de ambiente para desligar o agendador interno (ex.: quando ha
// varias instancias da API e so uma deve enviar). Ligado por omissao.
export const MEDICATION_SCHEDULER_DISABLED_ENV =
  'MEDICATION_SCHEDULER_DISABLED';

/**
 * Reserva dos lembretes de medicacao dentro do proprio processo. O cron
 * externo (docs/adr/0006) falha com frequencia: uma toma so conta como "a
 * horas" durante MEDICATION_REMINDER_WINDOW_MINUTES, por isso um unico
 * disparo perdido da manha significa nenhum aviso nesse dia. Aqui corre
 * todos os minutos. E idempotente: MedicationsService reclama cada toma
 * (remindedAt, condicional na BD) ANTES de enviar e e single-flight, por isso
 * o cron externo, este e outras instancias nunca enviam o mesmo aviso duas
 * vezes.
 */
@Injectable()
export class MedicationReminderSchedulerService {
  private readonly logger = new Logger(MedicationReminderSchedulerService.name);
  private running = false;

  constructor(private readonly medications: MedicationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<number> {
    if (process.env[MEDICATION_SCHEDULER_DISABLED_ENV] === 'true') return 0;
    // Sem sobreposicao: uma execucao lenta nao arranca outra por cima.
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.medications.sendDueReminders();
    } catch (error) {
      this.logger.error(
        `Lembretes de medicacao (agendador interno) falharam: ${(error as Error).message}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
