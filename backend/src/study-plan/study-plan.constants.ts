import { Difficulty } from '@prisma/client';

export const MINUTES_PER_DAY = 1440;

// Limite de estudo por dia quando o utilizador ainda não escolheu um
// (User.dailyStudyLimitMinutes null). É uma escolha de produto: o
// algoritmo greedy sozinho encheria cada minuto livre do dia, que é
// exatamente a sobrecarga que o OverloadAlertCard já existe para sinalizar.
export const DEFAULT_DAILY_STUDY_LIMIT_MINUTES = 240;
export const MIN_DAILY_STUDY_LIMIT_MINUTES = 30;
export const MAX_DAILY_STUDY_LIMIT_MINUTES = 720;

// Quanto o plano pode ultrapassar o limite diário, por dia, numa segunda
// passagem, antes de dar a task como impossível de encaixar. Tudo o que
// cair aqui é marcado como overtime.
export const OVERTIME_EXTRA_MINUTES_PER_DAY = 120;

// Nenhum bloco sugerido tem menos do que isto, exceto quando é mesmo o
// que falta de uma task (um resto de 10 minutos continua a ser agendável).
export const MIN_BLOCK_MINUTES = 20;

// Mínimo de tasks concluídas numa cadeira para a sua média mandar na
// estimativa: com uma só, um dia mau de estudo vira "a regra".
export const MIN_HISTORY_SAMPLES = 2;

// Limites de sanidade para qualquer estimativa (manual, calibrada ou
// prevista) antes de entrar no plano. O máximo cobre uma frequência
// difícil com várias matérias (15h), mais do que isso quase de certeza é
// um erro de digitação.
export const MIN_TASK_MINUTES = 15;
export const MAX_TASK_MINUTES = 900;

// Task que já passou a estimativa mas continua por concluir: reserva-se
// este resto em vez de a dar como "sem trabalho pendente".
export const MIN_REMAINING_WHEN_OVER_ESTIMATE = 30;

// Abaixo desta diferença face a 1.0 a calibração não vale a pena mostrar
// como "ajustada" (ruído).
export const CALIBRATION_VISIBLE_DELTA = 0.05;

// Estimativa de último recurso quando a task não tem estimativa manual, o
// modelo ainda não tem dados e a cadeira não tem histórico. Duas tabelas:
// uma frequência/teste/projeto (task com peso na nota) pede MUITO mais
// estudo do que um exercício solto da mesma dificuldade. Os valores
// graded partem de um caso real: uma frequência "fácil" pedia ~6h.
export const DEFAULT_MINUTES_UNGRADED: Record<Difficulty, number> = {
  VERY_EASY: 30,
  EASY: 60,
  MEDIUM: 90,
  HARD: 120,
  VERY_HARD: 180,
};

export const DEFAULT_MINUTES_GRADED: Record<Difficulty, number> = {
  VERY_EASY: 240,
  EASY: 360,
  MEDIUM: 480,
  HARD: 600,
  VERY_HARD: 780,
};
