import { Difficulty } from '@prisma/client';

// Proxy numérico 1-5 para Difficulty, usado sempre que a dificuldade de
// uma Task precisa de entrar numa fórmula/feature em vez de ser só
// mostrada como label. Partilhado entre TasksService.findToday() (score
// de prioridade do plano do dia) e PredictionService (feature do modelo
// de previsão de duração) - antes vivia só como const local em
// tasks.service.ts, extraído para aqui na primeira vez que um segundo
// consumidor precisou exatamente do mesmo mapeamento.
export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5,
};
