import { createTask } from '../api/userService';
import { addSubtasksBulk } from '../api/subtasksService';
import type { Task, TaskWriteInput } from '../types/models';

// Recria uma tarefa apagada com os mesmos dados (o id muda). Usado por
// "Anular" depois de apagar. Mantem o estado (progresso, nota real, fixada)
// e a checklist; o historico e os anexos nao voltam.
export async function restoreTask(task: Task): Promise<Task> {
  const input: TaskWriteInput & { tags?: string[] } = {
    title: task.title,
    areaId: task.areaId,
    periodId: task.periodId ?? undefined,
    date: task.date,
    type: task.type,
    academicType: task.academicType,
    topics: task.topics,
    notes: task.notes,
    tags: task.tags,
    referenceLink: task.referenceLink,
    isPinned: task.isPinned,
    difficulty: task.difficulty,
    effort: task.effort ?? null,
    dateCertainty: task.dateCertainty,
    isBlocked: task.isBlocked,
    availableFrom: task.availableFrom ?? null,
    submissionDate: task.submissionDate ?? null,
    priority: task.priority ?? undefined,
    progressStatus: task.progressStatus,
    weightPercentage: task.weightPercentage,
    estimatedMinutes: task.estimatedMinutes ?? null,
    targetGrade: task.targetGrade ?? null,
    realGrade: task.realGrade ?? null,
    calendarDurationMinutes: task.calendarDurationMinutes ?? null,
  };
  const created = await createTask(input);
  const titles = (task.subtasks ?? []).map((s) => s.title);
  if (titles.length === 0) return created;
  try {
    return { ...created, subtasks: await addSubtasksBulk(created.id, titles) };
  } catch {
    return created;
  }
}
