import { attributeSessions } from './session-attribution.util';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const at = (iso: string) => new Date(iso);
const session = (
  over: Partial<{
    taskId: string | null;
    areaId: string | null;
    startedAt: Date;
    endedAt: Date | null;
  }> = {},
) => ({
  taskId: null,
  areaId: 'redes',
  startedAt: at('2026-10-15T10:00:00Z'),
  endedAt: at('2026-10-15T11:00:00Z'),
  ...over,
});

const tasks = [
  { id: 'teste1', areaId: 'redes', date: day('2026-10-20') },
  { id: 'teste2', areaId: 'redes', date: day('2026-11-10') },
  { id: 'exame', areaId: 'so', date: day('2026-10-22') },
];

describe('attributeSessions', () => {
  it('a sessao ligada a uma task fica nessa task, seja quando for', () => {
    const old = session({
      taskId: 'teste2',
      startedAt: at('2026-08-01T10:00:00Z'),
    });
    expect(attributeSessions(tasks, [old]).get('teste2')).toEqual([old]);
  });

  it('a sessao so da cadeira vai para o proximo prazo dessa cadeira', () => {
    const s = session();
    const result = attributeSessions(tasks, [s]);
    expect(result.get('teste1')).toEqual([s]);
    expect(result.get('teste2')).toBeUndefined();
  });

  it('conta o proprio dia do prazo e passa para o seguinte depois dele', () => {
    const morning = session({ startedAt: at('2026-10-20T08:00:00Z') });
    const after = session({ startedAt: at('2026-10-28T10:00:00Z') });
    const result = attributeSessions(tasks, [morning, after]);
    expect(result.get('teste1')).toEqual([morning]);
    expect(result.get('teste2')).toEqual([after]);
  });

  it('fora dos 14 dias antes do proximo prazo nao conta para nenhum', () => {
    const tooEarly = session({ startedAt: at('2026-09-20T10:00:00Z') });
    expect(attributeSessions(tasks, [tooEarly]).size).toBe(0);
  });

  it('ignora sessoes de outras tasks, sem cadeira ou por terminar', () => {
    const result = attributeSessions(tasks, [
      session({ taskId: 'outra-task' }),
      session({ areaId: null }),
      session({ endedAt: null }),
      session({ areaId: 'outra-cadeira' }),
    ]);
    expect(result.size).toBe(0);
  });
});
