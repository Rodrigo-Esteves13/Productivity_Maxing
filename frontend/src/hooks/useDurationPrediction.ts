import { useEffect, useRef, useState } from 'react';
import { predictTaskDuration } from '../api/predictionService';
import type { DurationPrediction } from '../api/predictionService';
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
// de puxar uma dependência só para isto.
export function useDurationPrediction({
  type,
  academicType,
  difficulty,
  weightPercentage,
  taskId,
}: UseDurationPredictionArgs) {
  const [prediction, setPrediction] = useState<DurationPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!type || !difficulty) {
      setPrediction(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setIsLoading(true);
      predictTaskDuration({
        type,
        academicType: academicType || undefined,
        difficulty: difficulty as Difficulty,
        weightPercentage: weightPercentage ? parseFloat(weightPercentage) : undefined,
        taskId,
      })
        .then((result) => {
          // Uma resposta atrasada de um pedido antigo (ex: o user mudou o
          // Type outra vez antes desta voltar) nunca deve pisar o
          // resultado mais recente.
          if (currentRequestId === requestIdRef.current) {
            setPrediction(result);
          }
        })
        .catch(() => {
          if (currentRequestId === requestIdRef.current) {
            setPrediction(null);
          }
        })
        .finally(() => {
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [type, academicType, difficulty, weightPercentage, taskId]);

  return { prediction, isLoading };
}
