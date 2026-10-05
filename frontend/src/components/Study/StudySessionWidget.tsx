import { useState } from 'react';
import { useStudySession } from '../../hooks/useStudySession';
import { useActiveStudySession } from '../../context/useActiveStudySession';
import { useStopSession } from '../../hooks/useStopSession';
import { requestNotifyPermission } from '../../lib/focusAlerts';
import { enterFullscreen } from '../../lib/fullscreen';
import type { TimerPlan } from '../../lib/focusTimer';
import TimerModePicker from './focus/TimerModePicker';
import StopSessionPanel from './focus/StopSessionPanel';
import FocusModeOverlay from './focus/FocusModeOverlay';
import OpenNotesLink from './focus/OpenNotesLink';
import { formatElapsed } from '../../lib/formatDuration';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Input from '../UI/Input';
import FormField from '../UI/FormField';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';

// Data curta para o rótulo da task no dropdown (ex: "20 Set") - timeZone
// UTC de propósito: Task.date vem do backend como meia-noite UTC do dia
// pretendido (mesma convenção do resto da app), formatar sem UTC
// explícito reintroduzia o mesmo bug de "um dia a menos" que já
// apanhámos no horário (ver comentário grande em useSchedule.ts).
function formatTaskDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function StudySessionWidget() {
  const {
    activeSession,
    areas,
    tasks,
    elapsedSeconds,
    isLoading,
    isSubmitting,
    error,
    start,
  } = useStudySession();
  const { remainingSeconds, timerPlan } = useActiveStudySession();
  const { stopSession } = useStopSession();

  const [plan, setPlan] = useState<TimerPlan | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [note, setNote] = useState('');

  if (isLoading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6">
        <LoadingState message="Loading study session..." />
      </div>
    );
  }

  const handleStart = async () => {
    // O aviso de fim de bloco pode vir com a tab em segundo plano: pede-se
    // a permissao agora, dentro do clique, que e quando o browser deixa.
    if (plan) requestNotifyPermission();
    const started = await start(
      {
        taskId: taskId || undefined,
        areaId: areaId || undefined,
        note: note.trim() || undefined,
      },
      plan,
    );
    if (!started) return;
    setTaskId('');
    setAreaId('');
    setNote('');
  };

  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Selecionar uma task preenche automaticamente a cadeira dela - ver
  // pedido do Rodrigo. Selecionar uma cadeira filtra a lista de tasks
  // (abaixo) a essa cadeira; se a task já escolhida não for dessa
  // cadeira, deixa de fazer sentido continuar selecionada, por isso
  // limpa-se.
  const handleTaskChange = (id: string) => {
    setTaskId(id);
    const task = taskById.get(id);
    if (task) setAreaId(task.areaId);
  };

  const handleAreaChange = (id: string) => {
    setAreaId(id);
    const currentTask = taskById.get(taskId);
    if (id && currentTask && currentTask.areaId !== id) {
      setTaskId('');
    }
  };

  const visibleTasks = areaId ? tasks.filter((t) => t.areaId === areaId) : tasks;

  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
  // Agrupado por cadeira (Area) - task.date NÃO tem de ser hoje: estudar
  // com antecedência para uma prova é o caso normal, o dropdown já não
  // se limita ao "Today's Plan". Sem agrupar quando já há uma cadeira
  // selecionada (visibleTasks já é só dessa cadeira - um único optgroup
  // seria ruído).
  const tasksByArea = new Map<string, typeof tasks>();
  const noAreaLabel = 'No subject';
  for (const task of visibleTasks) {
    const label = areaNameById.get(task.areaId) ?? noAreaLabel;
    const list = tasksByArea.get(label) ?? [];
    list.push(task);
    tasksByArea.set(label, list);
  }
  const groupLabels = [...tasksByArea.keys()].sort((a, b) =>
    a === noAreaLabel ? 1 : b === noAreaLabel ? -1 : a.localeCompare(b),
  );

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-4">Study session</h2>

      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      {activeSession ? (
        <div className="flex flex-col gap-4">
          <div className="text-center py-6">
            <p className="text-4xl font-mono font-bold text-violet-400 tabular-nums">
              {formatElapsed(remainingSeconds ?? elapsedSeconds)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {timerPlan === null
                ? 'Counting up'
                : remainingSeconds === 0
                  ? 'Block finished'
                  : `Left of ${timerPlan.focusMinutes} min`}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {activeSession.task?.title ??
                activeSession.area?.name ??
                'Untitled session'}
            </p>
            <div className="mt-2">
              <OpenNotesLink areaId={activeSession.areaId} />
            </div>
          </div>

          {isStopping ? (
            <StopSessionPanel
              taskTitle={activeSession.task?.title ?? null}
              isSubmitting={isSubmitting}
              onCancel={() => setIsStopping(false)}
              onConfirm={async ({ markTaskDone, ...options }) => {
                if (await stopSession(options, markTaskDone)) setIsStopping(false);
              }}
            />
          ) : (
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setIsStopping(true)} disabled={isSubmitting} className="flex-1">
                Stop session
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  enterFullscreen();
                  setIsFocusMode(true);
                }}
              >
                Focus mode
              </Button>
            </div>
          )}

          {isFocusMode && <FocusModeOverlay onClose={() => setIsFocusMode(false)} />}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <FormField label="Task (optional)" htmlFor="session-task">
            <Select
              id="session-task"
              value={taskId}
              onChange={(e) => handleTaskChange(e.target.value)}
            >
              <option value="">No task</option>
              {groupLabels.map((label) => (
                <optgroup key={label} label={label}>
                  {(tasksByArea.get(label) ?? []).map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} ({formatTaskDate(task.date)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </FormField>

          <FormField label="Area (optional)" htmlFor="session-area">
            <Select
              id="session-area"
              value={areaId}
              onChange={(e) => handleAreaChange(e.target.value)}
            >
              <option value="">No area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Note (optional)" htmlFor="start-note">
            <Input
              id="start-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What are you going to study?"
              maxLength={500}
            />
          </FormField>

          <FormField label="Timer" htmlFor="session-timer">
            <TimerModePicker value={plan} onChange={setPlan} />
          </FormField>

          <Button
            variant="primary"
            onClick={() => void handleStart()}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Starting...' : 'Start session'}
          </Button>
        </div>
      )}
    </div>
  );
}
