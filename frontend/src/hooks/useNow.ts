import { useState } from 'react';
import { MS_PER_MINUTE } from '../lib/timeConstants';
import { useVisibleInterval } from './useVisibleInterval';

// Hora atual como estado, renovada de `intervalMs` em `intervalMs` (so com o
// separador visivel). Usar isto em vez de `new Date()` no render: o React
// Compiler memoiza o render e um `new Date()` solto ficava congelado ate
// mudar outra dependencia (ou para sempre, se nao houver nenhuma).
export function useNow(intervalMs: number = MS_PER_MINUTE): Date {
  const [now, setNow] = useState(() => new Date());
  useVisibleInterval(() => setNow(new Date()), intervalMs);
  return now;
}
