// Silent-bug audit (area b) - repro test. FAILS while the bug exists.
//
// TaskEditForm -> buildTaskPayload -> PATCH /tasks/:id. A field the user
// empties is sent as `undefined`, which JSON.stringify drops, and the
// backend (UpdateTaskDto = PartialType, Prisma update) treats a missing
// field as "do not touch". The edit saves with a success state, but the old
// value stays in the database.
import { describe, expect, it } from 'vitest';
import { buildTaskPayload } from './taskPayload';
import type { TaskFormFieldValues } from '../components/Tasks/TaskFormFields';

const clearedEdit: TaskFormFieldValues = {
  title: 'Exam',
  date: '2026-11-10',
  type: 'ACADEMICO',
  academicType: '',
  difficulty: 'MEDIUM',
  priority: '',
  areaId: 'a1',
  topics: '',
  referenceLink: '',
  notes: '',
  targetGrade: '',
  weightPercentage: '',
  estimatedMinutes: '',
  realGrade: '',
  progressStatus: 'ON_TRACK',
  recalledStudyMinutes: '',
  isPinned: false,
  syncToCalendar: false,
  calendarTime: '',
  calendarDurationMinutes: '60',
} as TaskFormFieldValues;

describe('silent-audit b: clearing fields in TaskEditForm', () => {
  // What actually goes over the wire (axios uses JSON.stringify).
  const wire = JSON.parse(
    JSON.stringify(buildTaskPayload(clearedEdit, { includeRealGrade: true })),
  ) as Record<string, unknown>;

  it.each([
    'weightPercentage',
    'targetGrade',
    'realGrade',
    'estimatedMinutes',
    'recalledStudyMinutes',
    'notes',
    'topics',
    'referenceLink',
  ])('B-05: an emptied "%s" is sent as null so the backend clears it', (field) => {
    expect(wire).toHaveProperty(field, null);
  });
});
