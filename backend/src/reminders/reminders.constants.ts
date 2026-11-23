// Header com o segredo partilhado do cron externo.
export const CRON_SECRET_HEADER = 'x-cron-secret';
// Throttle apertado: o cron chama de 15 em 15 minutos e um limite baixo trava
// tentativas de adivinhar o CRON_SECRET.
export const CRON_REQUESTS_PER_MINUTE = 5;
