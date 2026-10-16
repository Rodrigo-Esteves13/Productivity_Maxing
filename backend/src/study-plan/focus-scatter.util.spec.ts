import {
  buildFocusScatter,
  type ScatterSession,
  type ScatterTask,
} from './focus-scatter.util';

const task = (over: Partial<ScatterTask> = {}): ScatterTask => ({
  id: 't1',
  title: 'Teste 1',
  areaId: 'a1',
  areaName: 'Redes',
  date: new Date('2026-10-20T00:00:00Z'),
  fraction: 0.75,
  ...over,
});
const session = (over: Partial<ScatterSession> = {}): ScatterSession => ({
  taskId: null,
  areaId: 'a1',
  startedAt: new Date('2026-10-15T10:00:00Z'),
  minutes: 60,
  focus: 4,
  ...over,
});

describe('buildFocusScatter', () => {
  it('calcula foco ponderado e nota em % por task', () => {
    const [point] = buildFocusScatter(
      [task()],
      [session({ minutes: 60, focus: 2 }), session({ minutes: 180, focus: 4 })],
    );
    expect(point.avgFocus).toBe(3.5);
    expect(point.gradePercent).toBe(75);
    expect(point.ratedMinutes).toBe(240);
  });

  it('ignora sessoes fora da janela de 14 dias antes do prazo', () => {
    const points = buildFocusScatter(
      [task()],
      [
        session({ startedAt: new Date('2026-09-01T10:00:00Z') }),
        session({ startedAt: new Date('2026-10-25T10:00:00Z') }),
      ],
    );
    expect(points).toHaveLength(0);
  });

  it('ignora sessoes de outra cadeira e sem foco', () => {
    const points = buildFocusScatter(
      [task()],
      [session({ areaId: 'outra' }), session({ focus: null })],
    );
    expect(points).toHaveLength(0);
  });

  it('conta sessoes ligadas diretamente a task mesmo sem cadeira', () => {
    const points = buildFocusScatter(
      [task()],
      [session({ taskId: 't1', areaId: null, focus: 5 })],
    );
    expect(points[0].avgFocus).toBe(5);
  });

  it('ordena da task mais recente para a mais antiga', () => {
    const points = buildFocusScatter(
      [
        task({ id: 'a', date: new Date('2026-10-20T00:00:00Z') }),
        task({ id: 'b', date: new Date('2026-10-22T00:00:00Z') }),
      ],
      [session()],
    );
    expect(points.map((p) => p.taskId)).toEqual(['b', 'a']);
  });
});
