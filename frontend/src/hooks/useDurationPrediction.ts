import { useEffect, useState } from 'react';
import { predictTaskDuration } from '../api/predictionService';
import type { DurationPrediction } from '../api/predictionService';
import { isRequestCanceled } from '../lib/abortable';
import type { Difficulty } from '../types/models';

const DEBOUNCE_MS = 500;

interface UseDurationPredictionArgs {
  type: string;
  academicType: string;
  difficulty: string;
  weightPercentage: string;
  taskId?: string;
}

// Debounced para que trocar Type/Difficulty/Weight rapidamente enquanto se
// preenche o formulário não dispare um pedido por tecla - mesma lógica de
// qualquer campo "pesquisa enquanto escreves", só que feita à mão em vez
// de puxar uma dependência só para isto. Um pedido ainda em voo e
// cancelado quando os valores mudam outra vez, por isso uma resposta
// atrasada nunca pisa o resultado mais recente.
export function useDurationPrediction({
  type,
  academicType,
  difficulty,
  weightPercentage,
  taskId,
}: UseDurationPredictionArgs) {
  const [prediction, setPrediction] = useState<DurationPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!type || !difficulty) {
      setPrediction(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      predictTaskDuration(
        {
          type,
          academicType: academicType || undefined,
          difficulty: difficulty as Difficulty,
          weightPercentage: weightPercentage ? parseFloat(weightPercentage) : undefined,
          taskId,
        },
        controller.signal,
      )
        .then((result) => {
          setPrediction(result);
          setIsLoading(false);
        })
        .catch((caught: unknown) => {
          if (isRequestCanceled(caught)) return;
          setPrediction(null);
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, academicType, difficulty, weightPercentage, taskId]);

  return { prediction, isLoading };
}
