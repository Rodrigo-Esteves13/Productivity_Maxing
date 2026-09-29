import { useContext } from 'react';
import { StudySessionContext } from './study-session-context';

export function useActiveStudySession() {
  const context = useContext(StudySessionContext);
  if (context === undefined) {
    throw new Error(
      'useActiveStudySession must be used within a StudySessionProvider',
    );
  }
  return context;
}
