export type PredictionMethod = 'insufficient_data' | 'linear_regression' | 'mlp';

export interface DurationPrediction {
  // null quando method = 'insufficient_data' - não há sugestão nenhuma
  // para dar ainda, o frontend deve tratar isto como "sem previsão", não
  // como "previsão de 0 minutos".
  predictedMinutes: number | null;
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
