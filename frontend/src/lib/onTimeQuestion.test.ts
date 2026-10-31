import { describe, expect, it } from 'vitest';
import { canReviewOnTime, onTimeQuestions } from './onTimeQuestion';
import { wasCompletedOnTime } from '../utils/deadlineCompliance';
import type { Task } from '../types/models';

const NOW = new Date('2026-11-05T10:00:00.000Z');

function task(overrides: Partial<Task>): Task {
  return {
    date: '2026-11-04T00:00:00.000Z',
    dateCertainty: 'EXACT',
    submissionDate: null,
    academicTypeIsEvent: false,
    progressStatus: 'COMPLETED',
    completedAt: '2026-11-05T10:00:00.000Z',
    ...overrides,
  } as unknown as Task;
}

describe('onTimeQuestions', () => {
  it('pergunta quando se conclui depois do prazo', () => {
    expect(onTimeQuestions(task({}), NOW)).toEqual(['main']);
  });

  it('nao pergunta dentro do prazo nem em testes ou datas por marcar', () => {
    expect(onTimeQuestions(task({ date: '2026-11-06T00:00:00.000Z' }), NOW)).toEqual([]);
    expect(onTimeQuestions(task({ academicTypeIsEvent: true }), NOW)).toEqual([]);
    expect(onTimeQuestions(task({ dateCertainty: 'UNKNOWN' }), NOW)).toEqual([]);
  });

  it('num trabalho em duas fases pergunta pela entrega e pela apresentacao', () => {
    const twoPhase = task({ submissionDate: '2026-11-02T00:00:00.000Z' });
    expect(onTimeQuestions(twoPhase, NOW)).toEqual(['submission', 'main']);
    // Apresentacao ainda por vir: so a entrega.
    expect(
      onTimeQuestions({ ...twoPhase, date: '2026-11-09T00:00:00.000Z' }, NOW),
    ).toEqual(['submission']);
  });
});

describe('wasCompletedOnTime com a resposta da pessoa', () => {
  it('"sim, a tempo" ganha ao calculo por completedAt', () => {
    expect(wasCompletedOnTime(task({}))).toBe(false);
    expect(wasCompletedOnTime(task({ onTime: true }))).toBe(true);
  });

  it('entrega fora do prazo conta como atraso', () => {
    expect(wasCompletedOnTime(task({ onTime: true, submissionOnTime: false }))).toBe(false);
  });
});

describe('canReviewOnTime', () => {
  it('deixa responder numa task concluida atrasada ou ja respondida', () => {
    expect(canReviewOnTime(task({}), NOW)).toBe(true);
    expect(canReviewOnTime(task({ onTime: true }), NOW)).toBe(true);
  });

  it('nao aparece se acabou a tempo, se nao esta concluida ou num teste', () => {
    expect(canReviewOnTime(task({ completedAt: '2026-11-03T10:00:00.000Z' }), NOW)).toBe(false);
    expect(canReviewOnTime(task({ progressStatus: 'ON_TRACK' }), NOW)).toBe(false);
    expect(canReviewOnTime(task({ academicTypeIsEvent: true }), NOW)).toBe(false);
  });
});
