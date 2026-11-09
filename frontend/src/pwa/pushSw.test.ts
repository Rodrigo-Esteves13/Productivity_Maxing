// Regression tests for public/push-sw.js (area d: D-03, D-07, D-09).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown) => void;

function loadWorker(apiBaseUrl?: string) {
  const source = readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8');
  const handlers: Record<string, Handler> = {};
  const client = {
    postMessage: vi.fn(),
    url: 'https://app.example.test/dashboard',
    navigate: vi.fn(),
    focus: vi.fn().mockResolvedValue(undefined),
  };
  const fakeSelf = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    registration: {
      showNotification: vi.fn().mockResolvedValue(undefined),
      pushManager: { subscribe: vi.fn().mockResolvedValue({ endpoint: 'new' }) },
    },
    clients: { matchAll: vi.fn().mockResolvedValue([client]), openWindow: vi.fn().mockResolvedValue(undefined) },
    location: { origin: 'https://app.example.test' },
    PMAXING_API_BASE_URL: apiBaseUrl,
  };
  new Function('self', source)(fakeSelf);
  async function dispatch(type: string, event: Record<string, unknown>) {
    let waited: Promise<unknown> = Promise.resolve();
    handlers[type]({
      ...event,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    });
    await waited;
  }
  return { fakeSelf, client, dispatch };
}

async function optionsFor(payload: Record<string, unknown>) {
  const worker = loadWorker();
  await worker.dispatch('push', { data: { json: () => payload } });
  return worker.fakeSelf.registration.showNotification.mock.calls[0][1] as NotificationOptions & {
    renotify?: boolean;
    timestamp?: number;
  };
}

describe('push-sw.js', () => {
  afterEach(() => vi.useRealTimers());

  it('re-alerts tagged pushes and leaves untagged ones alone (D-03)', async () => {
    expect((await optionsFor({ title: 'x', tag: 'medicationDue' })).renotify).toBe(true);
    expect((await optionsFor({ title: 'x' })).renotify).toBe(false);
  });

  it('shows the send time, not the arrival time (D-09)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T10:00:00Z'));
    const sentAt = new Date('2026-12-01T08:00:00Z').getTime();
    expect((await optionsFor({ title: 'x', sentAt })).timestamp).toBe(sentAt);
  });

  it('ignores invalid or future sentAt values', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-12-01T10:00:00Z').getTime();
    vi.setSystemTime(now);
    expect((await optionsFor({ title: 'x', sentAt: now + 60_000 })).timestamp).toBe(now);
    expect((await optionsFor({ title: 'x', sentAt: 'yesterday' })).timestamp).toBe(now);
    expect((await optionsFor({ title: 'x' })).timestamp).toBe(now);
  });

  it('on pushsubscriptionchange resubscribes and asks open windows to re-sync (D-07)', async () => {
    const worker = loadWorker();
    const applicationServerKey = new Uint8Array([1, 2, 3]).buffer;
    await worker.dispatch('pushsubscriptionchange', {
      oldSubscription: { options: { applicationServerKey } },
      newSubscription: null,
    });
    expect(worker.fakeSelf.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey,
    });
    expect(worker.client.postMessage).toHaveBeenCalledWith({ type: 'pmaxing-push-resync' });
  });

  it('does not resubscribe when the browser already did, and still notifies windows', async () => {
    const worker = loadWorker();
    await worker.dispatch('pushsubscriptionchange', { oldSubscription: null, newSubscription: { endpoint: 'n' } });
    expect(worker.fakeSelf.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(worker.client.postMessage).toHaveBeenCalledWith({ type: 'pmaxing-push-resync' });
  });

  describe('"Taken" action on medication reminders', () => {
    const API = 'https://api.example.test';
    const TOKEN = 'aaa.bbb.ccc';
    const medicationPush = (extra: Record<string, unknown> = {}) => ({
      title: 'Medication reminder',
      url: '/wellbeing',
      tag: 'medicationDue',
      actions: [{ action: 'taken', title: 'Tomei' }],
      actionToken: TOKEN,
      ...extra,
    });

    async function shown(worker: ReturnType<typeof loadWorker>, payload: Record<string, unknown>) {
      await worker.dispatch('push', { data: { json: () => payload } });
      return worker.fakeSelf.registration.showNotification.mock.calls[0][1] as NotificationOptions & {
        actions?: { action: string; title: string }[];
        data: { url: string; actionToken?: string };
      };
    }

    afterEach(() => vi.unstubAllGlobals());

    it('adds the translated button and keeps the token in the notification data', async () => {
      const options = await shown(loadWorker(API), medicationPush());
      expect(options.actions).toEqual([{ action: 'taken', title: 'Tomei' }]);
      expect(options.data.actionToken).toBe(TOKEN);
    });

    it('no button when the build has no valid API URL', async () => {
      for (const base of [undefined, '', 'javascript:alert(1)', 'http://api.example.test', 'https://u:p@api.example.test']) {
        const options = await shown(loadWorker(base), medicationPush());
        expect(options.actions).toBeUndefined();
        expect(options.data.actionToken).toBeUndefined();
      }
    });

    it('no button on other notifications or with a malformed token', async () => {
      expect((await shown(loadWorker(API), medicationPush({ tag: 'friendRequest' }))).actions).toBeUndefined();
      expect((await shown(loadWorker(API), medicationPush({ actionToken: 'not a token' }))).actions).toBeUndefined();
      expect((await shown(loadWorker(API), medicationPush({ actions: [{ action: 'delete', title: 'x' }] }))).actions).toBeUndefined();
    });

    it('tapping "Taken" POSTs only the token, without cookies, and does not open the app', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      const worker = loadWorker(`${API}/`);
      const close = vi.fn();
      await worker.dispatch('notificationclick', {
        action: 'taken',
        notification: { close, data: { url: '/wellbeing', actionToken: TOKEN } },
      });
      expect(close).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(`${API}/wellbeing/medications/dose-action`, expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify({ token: TOKEN }),
      }));
      expect(worker.fakeSelf.clients.openWindow).not.toHaveBeenCalled();
      expect(worker.client.navigate).not.toHaveBeenCalled();
      expect(worker.client.postMessage).toHaveBeenCalledWith({ type: 'pmaxing-push', tag: 'medicationTaken' });
    });

    it('opens the app when the request fails or is rejected', async () => {
      for (const fetchMock of [vi.fn().mockResolvedValue({ ok: false }), vi.fn().mockRejectedValue(new Error('offline'))]) {
        vi.stubGlobal('fetch', fetchMock);
        const worker = loadWorker(API);
        await worker.dispatch('notificationclick', {
          action: 'taken',
          notification: { close: vi.fn(), data: { url: '/wellbeing', actionToken: TOKEN } },
        });
        expect(worker.client.navigate).toHaveBeenCalledWith('https://app.example.test/wellbeing');
      }
    });

    it('tapping the notification body still just opens the app', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const worker = loadWorker(API);
      await worker.dispatch('notificationclick', {
        action: '',
        notification: { close: vi.fn(), data: { url: '/wellbeing', actionToken: TOKEN } },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(worker.client.navigate).toHaveBeenCalledWith('https://app.example.test/wellbeing');
    });
  });

  it('a failed resubscribe still notifies windows', async () => {
    const worker = loadWorker();
    worker.fakeSelf.registration.pushManager.subscribe.mockRejectedValueOnce(new Error('denied'));
    await worker.dispatch('pushsubscriptionchange', {
      oldSubscription: { options: { applicationServerKey: new Uint8Array([1]).buffer } },
    });
    expect(worker.client.postMessage).toHaveBeenCalledWith({ type: 'pmaxing-push-resync' });
  });
});
