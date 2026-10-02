export type PredictionMethod =
  'insufficient_data' | 'linear_regression' | 'mlp';

export interface DurationPrediction {
  // null quando method = 'insufficient_data' - não há sugestão nenhuma
  // para dar ainda, o frontend deve tratar isto como "sem previsão", não
  // como "previsão de 0 minutos".
  predictedMinutes: number | null;
  // Intervalo de ~80% (o real cai aqui 8 vezes em 10, com base no
  // histórico). null sem previsão ou sem dispersão mensurável.
  rangeMinutes: { low: number; high: number } | null;
  // Tasks deixadas de fora do treino por terem uma duração absurda
  // (tipicamente uma sessão esquecida ligada).
  trimmedSamples: number;
  method: PredictionMethod;
  // Quantas tasks concluídas (com tempo de estudo registado) entraram no
  // treino do modelo devolvido - usado pelo frontend para explicar a
  // sugestão ("baseado em 23 tasks") e para o texto de "faltam N para a
  // próxima fase".
  sampleSize: number;
  // Só preenchido quando o pedido inclui taskId e essa task já tem pelo
  // menos uma StudySession terminada - soma real dessas sessões, não uma
  // previsão. null quando não há sessões (ou quando não veio taskId).
  actualMinutes: number | null;
}

// Powers EstimationAccuracyCard.tsx on the Dashboard - a step back from
// PredictionService's own model (which SUGGESTS a duration going
// forward) to instead ask "historically, how good were Rodrigo's own
// manual estimates". Only tasks with BOTH estimatedMinutes set AND at
// least one finished StudySession logged count - see
// PredictionService.getEstimationAccuracy.
export interface EstimationAccuracy {
  sampleSize: number;
  // Mean of |actual-estimated|/estimated, as a percentage - 0 would mean
  // every estimate landed exactly on the real time. null when
  // sampleSize is 0 (nothing to compute yet).
  avgAbsPercentError: number | null;
  avgEstimatedMinutes: number | null;
  avgActualMinutes: number | null;
  // Within ESTIMATION_ACCURACY_TOLERANCE_PCT of the real time either way.
  accurateCount: number;
  // estimated meaningfully higher than actual (task took less time than
  // guessed).
  overestimatedCount: number;
  // estimated meaningfully lower than actual (task took more time than
  // guessed).
  underestimatedCount: number;
}
