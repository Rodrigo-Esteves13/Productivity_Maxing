import { MINUTES_PER_HOUR } from '../common/time.constants';

// Resumo da manha "N tasks para hoje": janela de envio em hora de Lisboa.
// Sai na primeira execucao do cron (15 em 15 min) a partir das 08:00; o fim
// da janela evita um resumo de manha a meio da tarde apos um restart.
export const DUE_TODAY_DIGEST_START_HOUR = 8;
export const DUE_TODAY_DIGEST_END_HOUR = 12;
export const DUE_TODAY_DIGEST_START_MINUTES =
  DUE_TODAY_DIGEST_START_HOUR * MINUTES_PER_HOUR;
export const DUE_TODAY_DIGEST_END_MINUTES =
  DUE_TODAY_DIGEST_END_HOUR * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const DUE_TODAY_DIGEST_USER_BATCH_SIZE = 500;
export const DUE_TODAY_DIGEST_PATH = '/tasks';
