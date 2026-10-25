// Regression test from the silent-bug audit (area a). Prisma is mocked.
import { WorkShiftCopyService } from './work-shift-copy.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('[silent-audit a-05] copy week drops the address and transport of one-off events', () => {
  it('a copied one-off event keeps its own address and commute mode', async () => {
    const source = {
      commitmentId: null,
      label: 'Dentist',
      bufferMinutes: 15,
      date: new Date('2026-09-28T00:00:00.000Z'), // Monday
      dayOfWeek: null,
      startMinutes: 600,
      endMinutes: 660,
      // Present in the DB row (WorkShift.address / commuteMode), used by the
      // itinerary (ItineraryService.buildRange) for travel legs.
      address: 'Rua do Dentista 1, Porto',
      commuteMode: 'WALKING',
    };
    const created: unknown[] = [];
    const prisma = {
      workShift: {
        findMany: jest
          .fn()
          // 1st call: sources of the origin week; 2nd: existing in target week
          .mockResolvedValueOnce([source])
          .mockResolvedValueOnce([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          created.push(args.data);
          return args;
        }),
      },
      commitment: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops: unknown[]) =>
        Promise.resolve(
          ops.map((op) => ({
            ...(op as { data: Record<string, unknown> }).data,
            id: 'new',
            commitment: null,
          })),
        ),
      ),
    };
    const service = new WorkShiftCopyService(
      prisma as unknown as PrismaService,
    );

    await service.copyWeek('u1', {
      mode: 'one-off',
      fromWeekStart: '2026-09-28',
      toWeekStart: '2026-10-05',
    });

    expect(created).toHaveLength(1);
    // BUG: COPY_FIELDS / ShiftSource / ShiftDraft have no address or
    // commuteMode, so the copy is saved with address=null and
    // commuteMode=null (user default). No message tells the user.
    expect(created[0]).toMatchObject({
      address: 'Rua do Dentista 1, Porto',
      commuteMode: 'WALKING',
    });
  });
});
