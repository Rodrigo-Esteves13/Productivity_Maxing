import { useEffect, useState } from 'react';
import { getWorkShiftRange } from '../api/workShiftsService';
import type { WorkShiftOccurrence } from '../types/models';

// Turnos expandidos para um intervalo concreto (a semana visível no
// WeekGrid). `refreshKey` muda quando o utilizador adiciona/remove turnos.
export function useWorkShiftRange(fromKey: string, toKey: string, refreshKey: number) {
  const [occurrences, setOccurrences] = useState<WorkShiftOccurrence[]>([]);

  useEffect(() => {
    let cancelled = false;
    getWorkShiftRange(fromKey, toKey)
      .then((data) => {
        if (!cancelled) setOccurrences(data);
      })
      // Falhar aqui não deve partir a grelha de aulas: só deixa de
      // mostrar os turnos por cima.
      .catch(() => {
        if (!cancelled) setOccurrences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey, refreshKey]);

  return occurrences;
}
