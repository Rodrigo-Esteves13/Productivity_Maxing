import { useState } from 'react';
import { useStudySession } from '../../hooks/useStudySession';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Input from '../UI/Input';
import FormField from '../UI/FormField';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

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
    stop,
  } = useStudySession();

  const [taskId, setTaskId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [note, setNote] = useState('');
  const [stopNote, setStopNote] = useState('');

  if (isLoading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <LoadingState message="Loading study session..." />
      </div>
    );
  }

  const handleStart = async () => {
    await start({
      taskId: taskId || undefined,
      areaId: areaId || undefined,
      note: note.trim() || undefined,
    });
    setTaskId('');
    setAreaId('');
    setNote('');
  };

  const handleStop = async () => {
    await stop(stopNote.trim() || undefined);
    setStopNote('');
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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 flex flex-col">
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
              {formatElapsed(elapsedSeconds)}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {activeSession.task?.title ??
                activeSession.area?.name ??
                'Untitled session'}
            </p>
          </div>

          <FormField label="Note (optional)" htmlFor="stop-note">
            <Input
              id="stop-note"
              value={stopNote}
              onChange={(e) => setStopNote(e.target.value)}
              placeholder="What did you study?"
              maxLength={500}
            />
          </FormField>

          <Button
            variant="primary"
            onClick={() => void handleStop()}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Stopping...' : 'Stop session'}
          </Button>
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
