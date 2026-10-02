import api from './client';
import type { Difficulty } from '../types/models';

export interface DurationPredictionRequest {
  type: string;
  academicType?: string;
  difficulty: Difficulty;
  weightPercentage?: number;
  taskId?: string;
  areaId?: string;
}

export type PredictionMethod = 'insufficient_data' | 'linear_regression' | 'mlp';

export interface DurationPrediction {
  predictedMinutes: number | null;
  // ~80% interval from your own history (null when there is no spread yet).
  rangeMinutes: { low: number; high: number } | null;
  // Tasks left out of training for having an absurd duration.
  trimmedSamples: number;
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

// Mirrors EstimationAccuracy in the backend's prediction.types.ts.
export interface EstimationAccuracy {
  sampleSize: number;
  avgAbsPercentError: number | null;
  avgEstimatedMinutes: number | null;
  avgActualMinutes: number | null;
  accurateCount: number;
  overestimatedCount: number;
  underestimatedCount: number;
}

export async function getEstimationAccuracy(): Promise<EstimationAccuracy> {
  const response = await api.get<EstimationAccuracy>('/predictions/accuracy');
  return response.data;
}
