import { useContext } from 'react';
import { StudyClockContext } from './study-session-context';

// Segundos da sessao ativa. Muda a cada segundo: usar so em componentes
// pequenos que mostram o tempo, nunca num cartao grande ou numa lista.
export function useStudyClock() {
  return useContext(StudyClockContext);
}
