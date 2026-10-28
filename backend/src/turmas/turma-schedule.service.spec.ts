jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
import { BadRequestException } from '@nestjs/common';
import {
  TurmaScheduleService,
  mergeSharedClasses,
} from './turma-schedule.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TurmaAccessService } from './turma-access.service';

const day = new Date('2026-11-02T00:00:00Z');
const row = (userId: string, subject = 'Redes') => ({
  userId,
  subject,
  date: day,
  startMinutes: 540,
  endMinutes: 660,
  location: 'B204',
  professor: null,
});

describe('mergeSharedClasses', () => {
  it('joins the same class of several members and marks mine', () => {
    const classes = mergeSharedClasses(
      [row('a'), row('b', 'REDES'), row('a', 'Moveis')],
      new Set(['redes|2026-11-02|540|660']),
    );
    expect(classes).toEqual([
      expect.objectContaining({ subject: 'Redes', sharedBy: 2, inMine: true }),
      expect.objectContaining({
        subject: 'Moveis',
        sharedBy: 1,
        inMine: false,
      }),
    ]);
  });
});

describe('TurmaScheduleService', () => {
  function setup(sharers: string[], rows: ReturnType<typeof row>[]) {
    const prisma = {
      turmaMember: {
        findMany: jest
          .fn()
          .mockResolvedValue(sharers.map((userId) => ({ userId }))),
      },
      classOccurrence: {
        findMany: jest.fn().mockResolvedValue(rows),
        upsert: jest.fn((args: unknown) => args),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
    };
    const access = { requireMember: jest.fn().mockResolvedValue({}) };
    const service = new TurmaScheduleService(
      prisma as unknown as PrismaService,
      access as unknown as TurmaAccessService,
    );
    return { service, prisma, access };
  }

  it('copies each shared class once, only from other members', async () => {
    const { service, prisma, access } = setup(
      ['me', 'a', 'b'],
      [row('a'), row('b')],
    );
    await expect(service.copySubject('me', 't1', 'Redes')).resolves.toEqual({
      copied: 1,
    });
    expect(access.requireMember).toHaveBeenCalledWith('me', 't1');
    const where = (
      prisma.classOccurrence.findMany.mock.calls[0] as [
        { where: { userId: unknown } },
      ]
    )[0].where;
    expect(where.userId).toEqual({ in: ['a', 'b'] });
    expect(prisma.classOccurrence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_externalUid: {
            userId: 'me',
            externalUid: 'turma:t1:redes|2026-11-02|540|660',
          },
        },
      }),
    );
  });

  it('refuses a subject nobody shares', async () => {
    const { service } = setup(['me'], []);
    await expect(
      service.copySubject('me', 't1', 'Redes'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
