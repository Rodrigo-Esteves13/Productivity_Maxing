import { TasksService } from './tasks.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function respond(extra: Record<string, unknown>) {
  const service = Object.create(TasksService.prototype) as unknown as {
    toResponse: (t: unknown) => Record<string, unknown>;
  };
  return service.toResponse({
    id: 't1',
    taskTypeId: 'tt',
    taskType: { key: 'PESSOAL' },
    academicTypeId: null,
    academicType: null,
    priorityId: null,
    priority: null,
    subtasks: [],
    ...extra,
  });
}

describe('TasksService.toResponse attachmentCount', () => {
  it('exposes the relation count and hides _count', () => {
    const out = respond({ _count: { attachments: 3 } });
    expect(out.attachmentCount).toBe(3);
    expect(out).not.toHaveProperty('_count');
  });

  it('falls back to 0 when the count is missing', () => {
    expect(respond({}).attachmentCount).toBe(0);
  });
});
