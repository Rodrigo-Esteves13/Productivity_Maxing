import { buildFocusScatter, type ScatterTask } from './focus-scatter.util';

const task = (over: Partial<ScatterTask> = {}): ScatterTask => ({
  id: 't1',
  title: 'Teste 1',
  areaName: 'Redes',
  date: new Date('2026-10-20T00:00:00Z'),
  fraction: 0.75,
  sessions: [],
  ...over,
});

describe('buildFocusScatter', () => {
  it('calcula foco ponderado pelos minutos e nota em % por task', () => {
    const [point] = buildFocusScatter([
      task({
        sessions: [
          { minutes: 60, focus: 2 },
          { minutes: 180, focus: 4 },
        ],
      }),
    ]);
    expect(point.avgFocus).toBe(3.5);
    expect(point.gradePercent).toBe(75);
    expect(point.ratedMinutes).toBe(240);
    expect(point.date).toBe('2026-10-20');
  });

  it('ignora sessoes sem foco e deixa de fora tasks sem nenhuma classificada', () => {
    const points = buildFocusScatter([
      task({ sessions: [{ minutes: 90, focus: null }] }),
      task({
        id: 't2',
        sessions: [
          { minutes: 30, focus: 5 },
          { minutes: 60, focus: null },
        ],
      }),
    ]);
    expect(points.map((p) => p.taskId)).toEqual(['t2']);
    expect(points[0].ratedMinutes).toBe(30);
  });

  it('ordena das mais recentes para as mais antigas', () => {
    const points = buildFocusScatter([
      task({
        id: 'old',
        date: new Date('2026-09-01T00:00:00Z'),
        sessions: [{ minutes: 30, focus: 3 }],
      }),
      task({ id: 'new', sessions: [{ minutes: 30, focus: 3 }] }),
    ]);
    expect(points.map((p) => p.taskId)).toEqual(['new', 'old']);
  });
});
