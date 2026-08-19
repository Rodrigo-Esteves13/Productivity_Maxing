import api from './client';
import type { Difficulty } from '../types/models';

export interface DurationPredictionRequest {
  type: string;
  academicType?: string;
  difficulty: Difficulty;
  weightPercentage?: number;
  taskId?: string;
}

export type PredictionMethod = 'insufficient_data' | 'linear_regression' | 'mlp';

export interface DurationPrediction {
  predictedMinutes: number | null;
  method: PredictionMethod;
  sampleSize: number;
  actualMinutes: number | null;
}

export async function predictTaskDuration(
  payload: DurationPredictionRequest,
): Promise<DurationPrediction> {
  const response = await api.post<DurationPrediction>('/predictions/duration', payload);
  return response.data;
}
