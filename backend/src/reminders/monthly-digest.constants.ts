import { MINUTES_PER_HOUR } from '../common/time.constants';

// Resumo mensal por email: sai no dia 1 de cada mes (hora de Lisboa), na
// primeira execucao do cron a partir da hora de inicio. O fim da janela (e
// o limite ao dia 1) restringe o risco de reenvio apos um restart, ja que o
// dedupe e em memoria (sem coluna nem tabela nova).
export const MONTHLY_DIGEST_SEND_DAY_OF_MONTH = 1;
export const MONTHLY_DIGEST_START_HOUR = 9;
export const MONTHLY_DIGEST_END_HOUR = 21;
export const MONTHLY_DIGEST_START_MINUTES =
  MONTHLY_DIGEST_START_HOUR * MINUTES_PER_HOUR;
export const MONTHLY_DIGEST_END_MINUTES =
  MONTHLY_DIGEST_END_HOUR * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const MONTHLY_DIGEST_USER_BATCH_SIZE = 200;
// Uma sessao esquecida aberta nao pode inflacionar o mes (igual a revisao
// semanal): tecto por sessao, em minutos.
export const MONTHLY_DIGEST_MAX_SESSION_MINUTES = 12 * MINUTES_PER_HOUR;
// Pagina da revisao (o botao do email).
export const MONTHLY_DIGEST_PATH = '/period-review';
// "YYYY-MM" (chave do mes, usada no dedupe).
export const MONTH_KEY_LENGTH = 'YYYY-MM'.length;
