// Regression tests for public/push-sw.js (area d: D-03, D-07, D-09).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown) => void;

function loadWorker() {
  const source = readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8');
  const handlers: Record<string, Handler> = {};
  const client = { postMessage: vi.fn() };
  const fakeSelf = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    registration: {
      showNotification: vi.fn().mockResolvedValue(undefined),
      pushManager: { subscribe: vi.fn().mockResolvedValue({ endpoint: 'new' }) },
    },
    clients: { matchAll: vi.fn().mockResolvedValue([client]) },
    location: { origin: 'https://app.example.test' },
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

  it('a failed resubscribe still notifies windows', async () => {
    const worker = loadWorker();
    worker.fakeSelf.registration.pushManager.subscribe.mockRejectedValueOnce(new Error('denied'));
    await worker.dispatch('pushsubscriptionchange', {
      oldSubscription: { options: { applicationServerKey: new Uint8Array([1]).buffer } },
    });
    expect(worker.client.postMessage).toHaveBeenCalledWith({ type: 'pmaxing-push-resync' });
  });
});
