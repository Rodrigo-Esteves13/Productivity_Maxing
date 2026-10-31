// Os services que o StudyPlanService injeta puxam dependencias ESM que o jest
// nao transforma; aqui so interessa a funcao pura.
jest.mock('../push/push.service', () => ({ PushService: class {} }));

import { DateCertainty } from '@prisma/client';
import { planningDeadlineKey } from './study-plan.service';

const today = new Date('2026-11-01T00:00:00.000Z');
const presentation = new Date('2026-11-20T00:00:00.000Z');

describe('planningDeadlineKey', () => {
  it('num trabalho em duas fases planeia ate a entrega', () => {
    expect(
      planningDeadlineKey(
        {
          date: presentation,
          dateCertainty: DateCertainty.EXACT,
          submissionDate: new Date('2026-11-18T00:00:00.000Z'),
        },
        today,
      ),
    ).toBe('2026-11-18');
  });

  it('sem entrega (ou com data por marcar) usa a data da task', () => {
    expect(
      planningDeadlineKey(
        { date: presentation, dateCertainty: DateCertainty.EXACT },
        today,
      ),
    ).toBe('2026-11-20');
    expect(
      planningDeadlineKey(
        {
          date: presentation,
          dateCertainty: DateCertainty.UNKNOWN,
          submissionDate: new Date('2026-11-18T00:00:00.000Z'),
        },
        today,
      ),
    ).toBe('2026-11-20');
  });
});
