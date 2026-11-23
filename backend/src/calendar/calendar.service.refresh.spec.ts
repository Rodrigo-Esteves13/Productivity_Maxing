// Refresh do token Google (401/400 do endpoint OAuth) e upsert de eventos
// (POST/PATCH, 404/410, calendario apagado, corpo dia inteiro vs com hora).
// fetch global mockado, Prisma mockado: sem rede nem BD.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
import { BadRequestException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { CalendarService } from './calendar.service';
import {
  GOOGLE_CALENDAR_API_URL,
  GOOGLE_CALENDAR_APP_SCOPE,
  GOOGLE_TOKEN_URL,
} from '../auth/google-oauth.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from '../auth/auth.service';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const text = (status: number, body = '') => new Response(body, { status });

type Task = Parameters<CalendarService['upsertEventForTask']>[1];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Exam',
    date: new Date('2026-06-10T00:00:00.000Z'),
    dateCertainty: 'FIRM',
    submissionDate: null,
    topics: null,
    difficulty: 'MEDIUM',
    progressStatus: 'ON_TRACK',
    referenceLink: null,
    weightPercentage: null,
    targetGrade: null,
    realGrade: null,
    googleCalendarEventId: null,
    calendarDurationMinutes: null,
    area: null,
    taskType: null,
    academicType: null,
    ...overrides,
  } as Task;
}

function setup(
  opts: { calendarId?: string | null; refreshToken?: string | null } = {},
) {
  const calendarId = opts.calendarId === undefined ? 'cal1' : opts.calendarId;
  const prisma = {
    identity: {
      findFirst: jest.fn().mockResolvedValue({ calendarId }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const authService = {
    getDecryptedProviderTokens: jest.fn().mockResolvedValue(
      opts.refreshToken === null
        ? { refreshToken: null }
        : {
            refreshToken: opts.refreshToken ?? 'rt-1',
          },
    ),
  };
  const service = new CalendarService(
    prisma as unknown as PrismaService,
    authService as unknown as AuthService,
  );
  return { prisma, authService, service };
}

describe('CalendarService token refresh', () => {
  const env = { ...process.env };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
    process.env = { ...env };
  });

  it('posts the stored refresh token to the Google token endpoint and returns the access token', async () => {
    const { service, authService } = setup();
    fetchMock.mockResolvedValueOnce(json(200, { access_token: 'at-1' }));

    await expect(service.getAccessToken('u1')).resolves.toBe('at-1');

    expect(authService.getDecryptedProviderTokens).toHaveBeenCalledWith(
      'u1',
      Provider.GOOGLE,
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-1');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
  });

  it('a 401 from Google becomes a 400 asking to reconnect, without leaking the body', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(
      json(401, { error: 'invalid_client', error_description: 'secret-ish' }),
    );

    const err = await service.getAccessToken('u1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    const message = (err as BadRequestException).message;
    expect(message).toContain('reconnecting');
    expect(message).not.toContain('invalid_client');
    expect(message).not.toContain('secret-ish');
  });

  it('invalid_grant (revoked refresh token, 400) is also a 400 reconnect hint', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(json(400, { error: 'invalid_grant' }));
    await expect(service.getAccessToken('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('a 5xx from the token endpoint fails the same way and is not retried here', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(text(503, 'down'));
    await expect(service.getAccessToken('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('without a stored refresh token never calls Google', async () => {
    const { service } = setup({ refreshToken: null });
    await expect(service.getAccessToken('u1')).rejects.toThrow(
      /not connected/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('without any stored tokens never calls Google', async () => {
    const { service, authService } = setup();
    authService.getDecryptedProviderTokens.mockResolvedValueOnce(null);
    await expect(service.getAccessToken('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failed refresh aborts upsertEventForTask before any calendar call', async () => {
    const { service, prisma } = setup();
    fetchMock.mockResolvedValueOnce(text(401));
    await expect(
      service.upsertEventForTask('u1', task()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it('a failed refresh aborts deleteEventForTask too', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(text(401));
    await expect(
      service.deleteEventForTask('u1', 'evt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('CalendarService.upsertEventForTask', () => {
  let fetchMock: jest.SpyInstance;
  const eventsUrl = (cal: string) =>
    `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(cal)}/events`;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  const tokenOk = () => json(200, { access_token: 'at' });
  const callsTo = (method: string) =>
    (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      (c) => c[1]?.method === method,
    ) as [string, RequestInit][];

  it('creates with POST when the task has no event id', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'evt-new' }));

    await expect(service.upsertEventForTask('u1', task())).resolves.toBe(
      'evt-new',
    );

    const posts = callsTo('POST').filter((c) => c[0] !== GOOGLE_TOKEN_URL);
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe(eventsUrl('cal1'));
    expect((posts[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer at',
    );
    expect(callsTo('PATCH')).toHaveLength(0);
  });

  it('updates with PATCH when the task already has an event id', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'evt-1' }));

    await expect(
      service.upsertEventForTask(
        'u1',
        task({ googleCalendarEventId: 'evt-1' }),
      ),
    ).resolves.toBe('evt-1');

    const patches = callsTo('PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toBe(`${eventsUrl('cal1')}/evt-1`);
    expect(
      callsTo('POST').filter((c) => c[0] !== GOOGLE_TOKEN_URL),
    ).toHaveLength(0);
  });

  it.each([404, 410])(
    'PATCH answered %i: falls back to creating a new event',
    async (status) => {
      const { service } = setup();
      fetchMock
        .mockResolvedValueOnce(tokenOk())
        .mockResolvedValueOnce(text(status))
        .mockResolvedValueOnce(json(200, { id: 'evt-2' }));

      await expect(
        service.upsertEventForTask(
          'u1',
          task({ googleCalendarEventId: 'gone' }),
        ),
      ).resolves.toBe('evt-2');
      expect(callsTo('PATCH')).toHaveLength(1);
      expect(
        callsTo('POST').filter((c) => c[0] !== GOOGLE_TOKEN_URL),
      ).toHaveLength(1);
    },
  );

  it('PATCH answered 401 is a failure, not a silent re-create', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(text(401, 'unauthorized'));

    await expect(
      service.upsertEventForTask(
        'u1',
        task({ googleCalendarEventId: 'evt-1' }),
      ),
    ).rejects.toThrow('Failed to sync task with Google Calendar.');
    expect(
      callsTo('POST').filter((c) => c[0] !== GOOGLE_TOKEN_URL),
    ).toHaveLength(0);
  });

  it('POST answered 401 fails with a generic message and does not recreate the calendar', async () => {
    const { service, prisma } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(text(401, 'token expired'));

    const err = await service
      .upsertEventForTask('u1', task())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).not.toContain('token expired');
    expect(prisma.identity.updateMany).not.toHaveBeenCalled();
  });

  it('POST 404 means the calendar was deleted: recreates it, stores the id and retries once', async () => {
    const { service, prisma } = setup();
    prisma.identity.findFirst
      // getCalendarId
      .mockResolvedValueOnce({ calendarId: 'cal-old' })
      // replaceCalendar: ainda o mesmo id (ninguem o substituiu)
      .mockResolvedValueOnce({ calendarId: 'cal-old' });
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(text(404)) // POST evento
      .mockResolvedValueOnce(json(200, { id: 'cal-new' })) // POST calendars
      .mockResolvedValueOnce(json(200, { id: 'evt-3' })); // POST evento

    await expect(service.upsertEventForTask('u1', task())).resolves.toBe(
      'evt-3',
    );

    expect(prisma.identity.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', provider: Provider.GOOGLE },
      data: { calendarId: 'cal-new' },
    });
    const urls = (fetchMock.mock.calls as [string][]).map((c) => c[0]);
    expect(urls[urls.length - 1]).toBe(eventsUrl('cal-new'));
  });

  it('POST 404 twice gives up with an error (no loop)', async () => {
    const { service, prisma } = setup();
    prisma.identity.findFirst.mockResolvedValue({ calendarId: 'cal-old' });
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(text(404))
      .mockResolvedValueOnce(json(200, { id: 'cal-new' }))
      .mockResolvedValueOnce(text(404));

    await expect(
      service.upsertEventForTask('u1', task()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('creates the calendar on first use when none is stored', async () => {
    const { service, prisma } = setup({ calendarId: null });
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'cal-first' }))
      .mockResolvedValueOnce(json(200, { id: 'evt-4' }));

    await expect(service.upsertEventForTask('u1', task())).resolves.toBe(
      'evt-4',
    );
    expect(prisma.identity.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', provider: Provider.GOOGLE },
      data: { calendarId: 'cal-first' },
    });
  });

  it('a failed calendar creation is a 400 and no event is posted', async () => {
    const { service } = setup({ calendarId: null });
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(text(403, 'insufficient scope'));

    await expect(service.upsertEventForTask('u1', task())).rejects.toThrow(
      /Failed to create the Productivity Maxing calendar/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parallel first-use calls share one calendar creation', async () => {
    const { service } = setup({ calendarId: null });
    let created = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === GOOGLE_TOKEN_URL) return Promise.resolve(tokenOk());
      if (url === `${GOOGLE_CALENDAR_API_URL}/calendars`) {
        created += 1;
        return Promise.resolve(json(200, { id: 'cal-shared' }));
      }
      return Promise.resolve(
        json(200, { id: `evt-${init?.method ?? 'x'}-${created}` }),
      );
    });

    await Promise.all([
      service.upsertEventForTask('u1', task()),
      service.upsertEventForTask('u1', task({ id: 't2' })),
    ]);
    expect(created).toBe(1);
  });

  it('sends an all-day event (date only, exclusive end) for a midnight UTC task', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'e' }));

    await service.upsertEventForTask('u1', task());

    const [, init] = callsTo('POST').filter(
      (c) => c[0] !== GOOGLE_TOKEN_URL,
    )[0];
    const payload = JSON.parse(init.body as string) as {
      start: unknown;
      end: unknown;
    };
    expect(payload.start).toEqual({ date: '2026-06-10' });
    expect(payload.end).toEqual({ date: '2026-06-11' });
  });

  it('sends a timed event with the default 60 min duration', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'e' }));

    await service.upsertEventForTask(
      'u1',
      task({ date: new Date('2026-06-10T18:00:00.000Z') }),
    );

    const [, init] = callsTo('POST').filter(
      (c) => c[0] !== GOOGLE_TOKEN_URL,
    )[0];
    const payload = JSON.parse(init.body as string) as {
      start: { dateTime: string };
      end: { dateTime: string };
    };
    expect(payload.start.dateTime).toBe('2026-06-10T18:00:00.000Z');
    expect(payload.end.dateTime).toBe('2026-06-10T19:00:00.000Z');
  });

  it('honours calendarDurationMinutes for a timed event', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'e' }));

    await service.upsertEventForTask(
      'u1',
      task({
        date: new Date('2026-06-10T18:00:00.000Z'),
        calendarDurationMinutes: 90,
      }),
    );

    const [, init] = callsTo('POST').filter(
      (c) => c[0] !== GOOGLE_TOKEN_URL,
    )[0];
    const payload = JSON.parse(init.body as string) as {
      end: { dateTime: string };
    };
    expect(payload.end.dateTime).toBe('2026-06-10T19:30:00.000Z');
  });

  it('puts only filled fields in the description', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(json(200, { id: 'e' }));

    await service.upsertEventForTask(
      'u1',
      task({
        area: { name: 'Maths' },
        weightPercentage: 0,
        realGrade: 0,
        topics: 'Limits',
      }),
    );

    const [, init] = callsTo('POST').filter(
      (c) => c[0] !== GOOGLE_TOKEN_URL,
    )[0];
    const { description } = JSON.parse(init.body as string) as {
      description: string;
    };
    expect(description).toContain('Area: Maths');
    expect(description).toContain('Difficulty: Medium');
    expect(description).toContain('Status: On Track');
    expect(description).toContain('Topics: Limits');
    // 0 e um valor real (nao confundir com "sem valor")
    expect(description).toContain('Weight: 0%');
    expect(description).toContain('Real Grade: 0');
    expect(description).not.toContain('Target Grade');
    expect(description).not.toContain('Reference Link');
    expect(description).not.toContain('Type:');
  });

  it('url-encodes the calendar id in the events URL', () => {
    const { service } = setup();
    expect(service.eventsUrl('a@group.calendar.google.com')).toBe(
      `${GOOGLE_CALENDAR_API_URL}/calendars/a%40group.calendar.google.com/events`,
    );
  });
});

describe('CalendarService.deleteEventForTask', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it.each([200, 204, 404, 410])('treats %i as success', async (status) => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 'at' }))
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(
      service.deleteEventForTask('u1', 'evt'),
    ).resolves.toBeUndefined();
  });

  it('a 401 on delete is an error', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 'at' }))
      .mockResolvedValueOnce(text(401, 'nope'));
    await expect(service.deleteEventForTask('u1', 'evt')).rejects.toThrow(
      'Failed to remove event from Google Calendar.',
    );
  });
});

describe('CalendarService.getStatus', () => {
  it('needs both a refresh token and the calendar scope', async () => {
    const { service, prisma } = setup();
    const scope = GOOGLE_CALENDAR_APP_SCOPE;
    prisma.identity.findFirst
      .mockResolvedValueOnce({ refreshToken: 'x', scope })
      .mockResolvedValueOnce({ refreshToken: 'x', scope: 'email profile' })
      .mockResolvedValueOnce({ refreshToken: null, scope })
      .mockResolvedValueOnce(null);
    const results = [
      await service.getStatus('u1'),
      await service.getStatus('u1'),
      await service.getStatus('u1'),
      await service.getStatus('u1'),
    ];
    expect(results.map((r) => r.connected)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});
