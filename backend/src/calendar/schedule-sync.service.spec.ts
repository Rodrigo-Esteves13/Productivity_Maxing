// ScheduleSyncService: preview sem escritas, sync (create/update/delete,
// upsert da linha por evento), lock por utilizador, limite de operacoes,
// 404/410 do Google e removeAll. Dependencias e fetch mockados.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ScheduleSyncService } from './schedule-sync.service';
import { buildDesiredEvents } from './schedule-sync.builder';
import {
  MAX_OPERATIONS_PER_SYNC,
  MAX_PREVIEW_ITEMS,
  MAX_REMOVE_ALL_PER_REQUEST,
} from './schedule-sync.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { CalendarService } from './calendar.service';
import type { ScheduleService } from '../schedule/schedule.service';
import type { WorkShiftsService } from '../work-shifts/work-shifts.service';
import type { StudyPlanService } from '../study-plan/study-plan.service';
import type { ItineraryService } from '../schedule/itinerary.service';

// "Hoje" fixo (Lisboa): 2026-06-01 11:00 UTC = 12:00 locais.
const NOW = new Date('2026-06-01T11:00:00.000Z');

interface ClassRow {
  id: string;
  date: Date;
  startMinutes: number;
  endMinutes: number;
  subject: string;
  location: string | null;
  professor: string | null;
}

function classRow(over: Partial<ClassRow> = {}): ClassRow {
  return {
    id: 'k1',
    date: new Date('2026-06-02T00:00:00.000Z'),
    startMinutes: 600,
    endMinutes: 660,
    subject: 'Algebra',
    location: null,
    professor: null,
    ...over,
  };
}

function desiredFor(row: ClassRow) {
  return buildDesiredEvents({
    holidays: [],
    shifts: [],
    study: [],
    travel: [],
    classes: [
      {
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        startMinutes: row.startMinutes,
        endMinutes: row.endMinutes,
        subject: row.subject,
        location: row.location,
        professor: row.professor,
      },
    ],
  })[0];
}

function existingRow(row: ClassRow, over: Record<string, unknown> = {}) {
  const d = desiredFor(row);
  return {
    id: 'row-' + row.id,
    sourceKey: d.sourceKey,
    googleEventId: 'g-' + row.id,
    contentHash: d.contentHash,
    windowDate: row.date,
    startMinutes: d.startMinutes,
    endMinutes: d.endMinutes,
    title: d.title,
    ...over,
  };
}

// 204 nao admite corpo no construtor de Response.
const res = (status: number, body: unknown = {}) =>
  new Response(
    status === 204
      ? null
      : typeof body === 'string'
        ? body
        : JSON.stringify(body),
    { status },
  );

function setup(
  opts: {
    classes?: ClassRow[];
    existing?: Record<string, unknown>[];
    holidays?: { commitmentId: string; date: string; label: string | null }[];
  } = {},
) {
  const prisma = {
    calendarSyncedEvent: {
      findMany: jest.fn().mockResolvedValue(opts.existing ?? []),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const calendarService = {
    getAccessToken: jest.fn().mockResolvedValue('at'),
    getCalendarId: jest.fn().mockResolvedValue('cal1'),
    replaceCalendar: jest.fn().mockResolvedValue('cal2'),
    eventsUrl: (id: string) => `https://g/cal/${id}/events`,
  };
  const scheduleService = {
    findRange: jest.fn().mockResolvedValue(opts.classes ?? []),
  };
  const workShiftsService = {
    expandRange: jest
      .fn()
      .mockResolvedValue(
        (opts.holidays ?? []).map((h) => ({ ...h, skipped: 'HOLIDAY' })),
      ),
  };
  const studyPlanService = {
    generate: jest.fn().mockResolvedValue({ suggestions: [] }),
  };
  const itineraryService = {
    buildRange: jest.fn().mockResolvedValue(new Map()),
  };
  const service = new ScheduleSyncService(
    prisma as unknown as PrismaService,
    calendarService as unknown as CalendarService,
    scheduleService as unknown as ScheduleService,
    workShiftsService as unknown as WorkShiftsService,
    studyPlanService as unknown as StudyPlanService,
    itineraryService as unknown as ItineraryService,
  );
  return { service, prisma, calendarService, scheduleService };
}

describe('ScheduleSyncService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['setTimeout', 'nextTick'] });
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  const methods = () =>
    (fetchMock.mock.calls as [string, RequestInit][]).map((c) => c[1].method);

  describe('preview', () => {
    it('reports counts and never touches Google or writes rows', async () => {
      const kept = classRow({ id: 'k1' });
      const changed = classRow({ id: 'k2', subject: 'Physics' });
      const added = classRow({ id: 'k3', subject: 'Chem' });
      const { service, prisma, calendarService } = setup({
        classes: [kept, changed, added],
        existing: [
          existingRow(kept),
          existingRow(changed, { contentHash: 'stale' }),
          // futuro e ja nao desejado: remover
          existingRow(classRow({ id: 'gone' })),
        ],
      });

      const preview = await service.preview('u1', 3);

      expect(preview).toMatchObject({
        create: 1,
        update: 1,
        remove: 1,
        unchanged: 1,
        withinLimit: true,
        days: 3,
        hiddenCount: 0,
      });
      expect(preview.items.map((i) => i.action).sort()).toEqual([
        'create',
        'remove',
        'update',
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(calendarService.getAccessToken).not.toHaveBeenCalled();
      expect(prisma.calendarSyncedEvent.upsert).not.toHaveBeenCalled();
      expect(prisma.calendarSyncedEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('queries the window from today (Lisbon) for N days, scoped by user', async () => {
      const { service, prisma, scheduleService } = setup();
      await service.preview('u1', 3);

      const [, from, to] = scheduleService.findRange.mock.calls[0] as [
        string,
        Date,
        Date,
      ];
      expect(from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(to.toISOString()).toBe('2026-06-03T00:00:00.000Z');
      expect(prisma.calendarSyncedEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', windowDate: { gte: from, lte: to } },
        }),
      );
    });

    it('sorts by date then start and caps the listed items', async () => {
      const classes = Array.from({ length: MAX_PREVIEW_ITEMS + 5 }, (_, i) =>
        classRow({
          id: `k${i}`,
          startMinutes: 8 * 60 + i,
          endMinutes: 8 * 60 + i + 30,
        }),
      );
      const { service } = setup({ classes });
      const preview = await service.preview('u1', 3);
      expect(preview.items).toHaveLength(MAX_PREVIEW_ITEMS);
      expect(preview.hiddenCount).toBe(5);
      const starts = preview.items.map((i) => i.startMinutes);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });

    it('flags withinLimit=false above the operation cap', async () => {
      const classes = Array.from(
        { length: MAX_OPERATIONS_PER_SYNC + 1 },
        (_, i) =>
          classRow({
            id: `k${i}`,
            startMinutes: i,
            endMinutes: i + 1,
          }),
      );
      const { service } = setup({ classes });
      const preview = await service.preview('u1', 3);
      expect(preview.withinLimit).toBe(false);
    });

    it('turns a holiday shift into an all-day create', async () => {
      const { service } = setup({
        holidays: [
          { commitmentId: 'c1', date: '2026-06-02', label: 'Holiday' },
        ],
      });
      const preview = await service.preview('u1', 3);
      expect(preview.create).toBe(1);
      expect(preview.items[0].title).toBe('No work: Holiday');
    });
  });

  describe('sync', () => {
    it('creates new events with POST and upserts the row right after each one', async () => {
      const row = classRow();
      const { service, prisma } = setup({ classes: [row] });
      fetchMock.mockResolvedValueOnce(res(200, { id: 'g-new' }));

      const result = await service.sync('u1', 3);

      expect(result).toEqual({
        created: 1,
        updated: 0,
        deleted: 0,
        unchanged: 0,
        failed: 0,
      });
      expect(methods()).toEqual(['POST']);
      const sourceKey = desiredFor(row).sourceKey;
      expect(prisma.calendarSyncedEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_sourceKey: { userId: 'u1', sourceKey } },
          create: expect.objectContaining({
            userId: 'u1',
            sourceKey,
            googleEventId: 'g-new',
          }) as unknown,
          update: expect.objectContaining({
            googleEventId: 'g-new',
          }) as unknown,
        }),
      );
    });

    it('does nothing for unchanged events', async () => {
      const row = classRow();
      const { service, prisma } = setup({
        classes: [row],
        existing: [existingRow(row)],
      });
      const result = await service.sync('u1', 3);
      expect(result).toMatchObject({ unchanged: 1, created: 0, failed: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.calendarSyncedEvent.upsert).not.toHaveBeenCalled();
    });

    it('updates a changed timed event with PATCH and refreshes the stored row', async () => {
      const row = classRow({ subject: 'Physics' });
      const { service, prisma } = setup({
        classes: [row],
        existing: [existingRow(row, { contentHash: 'stale' })],
      });
      fetchMock.mockResolvedValueOnce(res(200, { id: 'g-k1' }));

      const result = await service.sync('u1', 3);

      expect(result.updated).toBe(1);
      expect(methods()).toEqual(['PATCH']);
      expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
        'https://g/cal/cal1/events/g-k1',
      );
      expect(prisma.calendarSyncedEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 'row-k1', userId: 'u1' },
        data: expect.objectContaining({
          contentHash: desiredFor(row).contentHash,
        }) as unknown,
      });
    });

    it('updates an all-day event with PUT (a PATCH would mix date and dateTime)', async () => {
      const holiday = {
        commitmentId: 'c1',
        date: '2026-06-02',
        label: 'Holiday',
      };
      const d = buildDesiredEvents({
        holidays: [holiday],
        classes: [],
        shifts: [],
        study: [],
        travel: [],
      })[0];
      const { service } = setup({
        holidays: [holiday],
        existing: [
          {
            id: 'row-h',
            sourceKey: d.sourceKey,
            googleEventId: 'g-h',
            contentHash: 'old-block-hash',
            windowDate: new Date('2026-06-02T00:00:00.000Z'),
            startMinutes: 0,
            endMinutes: 1440,
            title: d.title,
          },
        ],
      });
      fetchMock.mockResolvedValueOnce(res(200, { id: 'g-h' }));

      await service.sync('u1', 3);
      expect(methods()).toEqual(['PUT']);
    });

    it.each([404, 410])(
      'update answered %i: recreates the event with POST and upserts the row',
      async (status) => {
        const row = classRow();
        const { service, prisma } = setup({
          classes: [row],
          existing: [existingRow(row, { contentHash: 'stale' })],
        });
        fetchMock
          .mockResolvedValueOnce(res(status))
          .mockResolvedValueOnce(res(200, { id: 'g-again' }));

        const result = await service.sync('u1', 3);

        expect(methods()).toEqual(['PATCH', 'POST']);
        // Recriar conta como atualizacao (o evento passou a existir de novo).
        expect(result).toMatchObject({ updated: 1, failed: 0 });
        expect(prisma.calendarSyncedEvent.upsert).toHaveBeenCalledTimes(1);
      },
    );

    it('create 404 (calendar deleted) swaps the calendar and retries on the new one once', async () => {
      const { service, calendarService } = setup({ classes: [classRow()] });
      fetchMock
        .mockResolvedValueOnce(res(404))
        .mockResolvedValueOnce(res(200, { id: 'g-new' }));

      const result = await service.sync('u1', 3);

      expect(calendarService.replaceCalendar).toHaveBeenCalledWith(
        'u1',
        'at',
        'cal1',
      );
      expect(result.created).toBe(1);
      expect((fetchMock.mock.calls[1] as [string])[0]).toBe(
        'https://g/cal/cal2/events',
      );
    });

    it('a create that keeps failing is counted, not thrown, and writes no row', async () => {
      const { service, prisma } = setup({ classes: [classRow()] });
      fetchMock.mockResolvedValueOnce(res(401, 'unauthorized'));

      const result = await service.sync('u1', 3);

      expect(result).toMatchObject({ created: 0, failed: 1 });
      expect(prisma.calendarSyncedEvent.upsert).not.toHaveBeenCalled();
    });

    it('one failure does not stop the others', async () => {
      const a = classRow({ id: 'a', startMinutes: 480, endMinutes: 540 });
      const b = classRow({ id: 'b', startMinutes: 600, endMinutes: 660 });
      const { service } = setup({ classes: [a, b] });
      fetchMock
        .mockResolvedValueOnce(res(400, 'bad'))
        .mockResolvedValueOnce(res(200, { id: 'g-b' }));

      const result = await service.sync('u1', 3);
      expect(result).toMatchObject({ created: 1, failed: 1 });
    });

    it('deletes a future event that is no longer wanted, row included', async () => {
      const gone = classRow({ id: 'gone' });
      const { service, prisma } = setup({ existing: [existingRow(gone)] });
      fetchMock.mockResolvedValueOnce(res(204));

      const result = await service.sync('u1', 3);

      expect(result.deleted).toBe(1);
      expect(methods()).toEqual(['DELETE']);
      expect(prisma.calendarSyncedEvent.deleteMany).toHaveBeenCalledWith({
        where: { id: 'row-gone', userId: 'u1' },
      });
    });

    it.each([404, 410])(
      'delete answered %i still counts as deleted and drops the row',
      async (status) => {
        const gone = classRow({ id: 'gone' });
        const { service, prisma } = setup({ existing: [existingRow(gone)] });
        fetchMock.mockResolvedValueOnce(res(status));

        const result = await service.sync('u1', 3);

        expect(result).toMatchObject({ deleted: 1, failed: 0 });
        expect(prisma.calendarSyncedEvent.deleteMany).toHaveBeenCalled();
      },
    );

    it('a failed delete keeps the row and is counted as failed', async () => {
      const gone = classRow({ id: 'gone' });
      const { service, prisma } = setup({ existing: [existingRow(gone)] });
      fetchMock.mockResolvedValueOnce(res(401, 'nope'));

      const result = await service.sync('u1', 3);

      expect(result).toMatchObject({ deleted: 0, failed: 1 });
      expect(prisma.calendarSyncedEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('never deletes an event that already happened', async () => {
      const past = classRow({
        id: 'past',
        date: new Date('2026-06-01T00:00:00.000Z'),
        startMinutes: 480,
        endMinutes: 540, // antes das 12:00 de "agora"
      });
      const { service } = setup({ existing: [existingRow(past)] });
      const result = await service.sync('u1', 3);
      expect(result.deleted).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a sync above the operation cap before any Google write', async () => {
      const classes = Array.from(
        { length: MAX_OPERATIONS_PER_SYNC + 1 },
        (_, i) => classRow({ id: `k${i}`, startMinutes: i, endMinutes: i + 1 }),
      );
      const { service } = setup({ classes });
      await expect(service.sync('u1', 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('allows a new sync after the cap error (lock released)', async () => {
      const classes = Array.from(
        { length: MAX_OPERATIONS_PER_SYNC + 1 },
        (_, i) => classRow({ id: `k${i}`, startMinutes: i, endMinutes: i + 1 }),
      );
      const { service } = setup({ classes });
      await expect(service.sync('u1', 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.sync('u1', 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('a token refresh failure propagates and releases the lock', async () => {
      const { service, calendarService } = setup();
      calendarService.getAccessToken.mockRejectedValueOnce(
        new BadRequestException('reconnect'),
      );
      await expect(service.sync('u1', 3)).rejects.toThrow('reconnect');

      const result = await service.sync('u1', 3);
      expect(result.failed).toBe(0);
    });

    it('rejects a second concurrent sync for the same user with 409, other users run', async () => {
      const { service, calendarService } = setup();
      let release!: (token: string) => void;
      calendarService.getAccessToken.mockImplementationOnce(
        () => new Promise<string>((r) => (release = r)),
      );

      const first = service.sync('u1', 3);
      await expect(service.sync('u1', 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.sync('u2', 3)).resolves.toBeDefined();

      release('at');
      await expect(first).resolves.toBeDefined();
      // lock libertado
      await expect(service.sync('u1', 3)).resolves.toBeDefined();
    });
  });

  describe('removeAll', () => {
    it('deletes every stored event in Google and its row, scoped by user', async () => {
      const { service, prisma } = setup();
      prisma.calendarSyncedEvent.findMany.mockResolvedValueOnce([
        { id: 'r1', googleEventId: 'g1' },
        { id: 'r2', googleEventId: 'g2' },
      ]);
      prisma.calendarSyncedEvent.count.mockResolvedValueOnce(0);
      fetchMock.mockResolvedValue(res(204));

      await expect(service.removeAll('u1')).resolves.toEqual({
        deleted: 2,
        failed: 0,
        remaining: 0,
      });
      expect(prisma.calendarSyncedEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { id: true, googleEventId: true },
        take: MAX_REMOVE_ALL_PER_REQUEST,
      });
      expect(prisma.calendarSyncedEvent.deleteMany).toHaveBeenCalledWith({
        where: { id: 'r1', userId: 'u1' },
      });
    });

    it('treats 404/410 as deleted, keeps failures and reports what remains', async () => {
      const { service, prisma } = setup();
      prisma.calendarSyncedEvent.findMany.mockResolvedValueOnce([
        { id: 'r1', googleEventId: 'g1' },
        { id: 'r2', googleEventId: 'g2' },
        { id: 'r3', googleEventId: 'g3' },
      ]);
      prisma.calendarSyncedEvent.count.mockResolvedValueOnce(1);
      fetchMock.mockImplementation((url: string) => {
        if (url.endsWith('/g1')) return Promise.resolve(res(404));
        if (url.endsWith('/g2')) return Promise.resolve(res(401, 'nope'));
        return Promise.resolve(res(204));
      });

      const result = await service.removeAll('u1');

      expect(result).toEqual({ deleted: 2, failed: 1, remaining: 1 });
      const deletedIds = (
        prisma.calendarSyncedEvent.deleteMany.mock.calls as [
          { where: { id: string } },
        ][]
      ).map((c) => c[0].where.id);
      expect(deletedIds.sort()).toEqual(['r1', 'r3']);
    });

    it('is blocked while a sync runs for the same user', async () => {
      const { service, calendarService } = setup();
      let release!: (token: string) => void;
      calendarService.getAccessToken.mockImplementationOnce(
        () => new Promise<string>((r) => (release = r)),
      );
      const running = service.sync('u1', 3);
      await expect(service.removeAll('u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      release('at');
      await running;
    });

    it('releases the lock when the token refresh fails', async () => {
      const { service, calendarService } = setup();
      calendarService.getAccessToken.mockRejectedValueOnce(new Error('boom'));
      await expect(service.removeAll('u1')).rejects.toThrow('boom');
      await expect(service.removeAll('u1')).resolves.toEqual({
        deleted: 0,
        failed: 0,
        remaining: 0,
      });
    });
  });
});
