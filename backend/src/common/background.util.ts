import type { Logger } from '@nestjs/common';

/**
 * Corre uma tarefa sem a esperar, para o pedido HTTP responder logo (ex:
 * enviar um email no registo). Um SMTP lento ou bloqueado deixava o registo
 * pendurado minutos. Uma falha fica so no log, nunca chega ao cliente.
 */
export function runInBackground(
  task: Promise<unknown>,
  logger: Logger,
  label: string,
): void {
  void task.catch((err: unknown) => {
    logger.error(
      `${label} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}
