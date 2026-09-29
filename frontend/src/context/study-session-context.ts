import { createContext } from 'react';
import type { StudySession } from '../types/models';
import type { StartStudySessionInput } from '../api/studySessionsService';

export interface ActiveStudySessionContextType {
  activeSession: StudySession | null;
  elapsedSeconds: number;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  start: (input: StartStudySessionInput) => Promise<void>;
  stop: (note?: string) => Promise<void>;
}

export const StudySessionContext = createContext<
  ActiveStudySessionContextType | undefined
>(undefined);
