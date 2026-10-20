import { createContext } from 'react';
import type { StudySession } from '../types/models';
import type { StartStudySessionInput, StopStudySessionInput } from '../api/studySessionsService';
import type { ResumeSpec, RestBreak, TimerPlan } from '../lib/focusTimer';

// Estado da sessao que muda raramente (comecar, parar, pausas). O relogio
// que muda a cada segundo vive a parte em StudyClockContext: antes estava
// tudo no mesmo valor e, com uma sessao a correr, TODOS os consumidores
// (historico, cartoes do Focus, avisos) voltavam a renderizar 1x/s.
export interface ActiveStudySessionContextType {
  activeSession: StudySession | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  // Devolvem true se correu bem, para quem chama so limpar o formulario nesse caso.
  start: (input: StartStudySessionInput, plan?: TimerPlan | null) => Promise<boolean>;
  // `skipFocusPrompt`: quem ja perguntou o foco (painel de parar) nao quer o aviso global.
  stop: (options?: StopStudySessionInput, skipFocusPrompt?: boolean) => Promise<boolean>;
  // Contagem decrescente desta sessao (null = cronometro livre).
  timerPlan: TimerPlan | null;
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

// So o relogio: le isto (useStudyClock) apenas quem mostra os segundos.
export interface StudyClockContextType {
  elapsedSeconds: number;
  // Segundos que faltam no bloco (null = cronometro livre).
  remainingSeconds: number | null;
}

export const StudyClockContext = createContext<StudyClockContextType>({ elapsedSeconds: 0, remainingSeconds: null });
