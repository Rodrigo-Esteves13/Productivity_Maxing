import { useEffect, useState } from 'react';
import Button from '../UI/Button';
import Select from '../UI/Select';
import FormField from '../UI/FormField';
import LoadingState from '../UI/LoadingState';
import { useStudySession } from '../../hooks/useStudySession';
import { getUserTasks } from '../../api/userService';
import type { Task, StudySessionMode } from '../../types/models';

const POMODORO_WORK_SECONDS = 25 * 60;

function formatTime(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  return `${totalSeconds < 0 ? '-' : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Distracted',
  2: 'Meh',
  3: 'OK',
  4: 'Good',
  5: 'Great',
};

export default function StudySessionWidget() {
  const {
    activeSession,
    elapsedSeconds,
    isLoading,
    isStarting,
    isEnding,
    start,
    requestEnd,
    cancelEnd,
    confirmEnd,
  } = useStudySession();

  const [mode, setMode] = useState<StudySessionMode>('MANUAL');
  const [taskId, setTaskId] = useState('');
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Só precisamos da lista para o picker opcional "a que task se refere
    // isto" - falha silenciosa não deve impedir o resto do widget de
    // funcionar (dá sempre para começar uma sessão sem task ligada).
    getUserTasks()
      .then((tasks) => setPendingTasks(tasks.filter((t) => t.progressStatus !== 'COMPLETED')))
      .catch(() => setPendingTasks([]));
  }, []);

  if (isLoading) {
    return <LoadingState message="Checking for an active session..." className="h-32" />;
  }

  if (activeSession && !isEnding) {
    const isPomodoro = activeSession.mode === 'POMODORO';
    const pomodoroRemaining = POMODORO_WORK_SECONDS - elapsedSeconds;
    const isOvertime = isPomodoro && pomodoroRemaining < 0;

    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          {isPomodoro ? (isOvertime ? 'Break time - overtime' : 'Pomodoro in progress') : 'Session in progress'}
        </p>
        <p className={`text-5xl font-bold tabular-nums ${isOvertime ? 'text-amber-400' : 'text-white'}`}>
          {isPomodoro ? formatTime(pomodoroRemaining) : formatTime(elapsedSeconds)}
        </p>
        {isOvertime && (
          <p className="text-xs text-amber-500/80 mt-1">Your 25 min block ended - consider a short break.</p>
        )}
        <Button variant="secondary" onClick={requestEnd} className="mt-6 px-6">
          End Session
        </Button>
      </div>
    );
  }

  if (activeSession && isEnding) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 text-center">
        <p className="text-sm font-medium text-neutral-200 mb-1">How did it go?</p>
        <p className="text-xs text-neutral-500 mb-4">
          Optional - this is what teaches the "best time to study" model.
        </p>
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => confirmEnd(rating)}
              className="w-12 h-12 rounded-full border border-neutral-700 text-neutral-200 hover:border-violet-500 hover:text-violet-400 transition-colors flex flex-col items-center justify-center text-sm font-semibold"
              title={RATING_LABELS[rating]}
            >
              {rating}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => confirmEnd(undefined)}>
            Skip rating
          </Button>
          <Button variant="secondary" onClick={cancelEnd}>
            Cancel, keep going
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('MANUAL')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'MANUAL' ? 'bg-violet-700 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Manual timer
        </button>
        <button
          onClick={() => setMode('POMODORO')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'POMODORO' ? 'bg-violet-700 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Pomodoro (25 min)
        </button>
      </div>

      <FormField label="Linked task (optional)" htmlFor="study-session-task">
        <Select id="study-session-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">No specific task</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </FormField>

      <Button
        onClick={() => start(mode, taskId || undefined)}
        disabled={isStarting}
        className="w-full mt-4 py-2.5"
      >
        {isStarting ? 'Starting...' : 'Start Session'}
      </Button>
    </div>
  );
}
