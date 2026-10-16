import { createContext } from 'react';
import type { StudySession } from '../types/models';
import type { StartStudySessionInput, StopStudySessionInput } from '../api/studySessionsService';
import type { ResumeSpec, RestBreak, TimerPlan } from '../lib/focusTimer';

export interface ActiveStudySessionContextType {
  activeSession: StudySession | null;
  elapsedSeconds: number;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  // Devolvem true se correu bem, para quem chama so limpar o formulario nesse caso.
  start: (input: StartStudySessionInput, plan?: TimerPlan | null) => Promise<boolean>;
  // `skipFocusPrompt`: quem ja perguntou o foco (painel de parar) nao quer o aviso global.
  stop: (options?: StopStudySessionInput, skipFocusPrompt?: boolean) => Promise<boolean>;
  // Contagem decrescente desta sessao (null = cronometro livre).
  timerPlan: TimerPlan | null;
  remainingSeconds: number | null;
  // Pausa a decorrer entre dois blocos (null = nenhuma).
  restBreak: RestBreak | null;
  startBreak: (minutes: number, resume: ResumeSpec | null) => void;
  endBreak: () => void;
  // Ultima sessao parada SEM foco classificado: o aviso global pede o foco.
  // null = nada por classificar.
  justStopped: StudySession | null;
  dismissJustStopped: () => void;
}

export const StudySessionContext = createContext<
  ActiveStudySessionContextType | undefined
>(undefined);
