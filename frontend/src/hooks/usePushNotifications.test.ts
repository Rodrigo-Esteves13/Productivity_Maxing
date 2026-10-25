// Regression tests for push subscription sync (area d: D-06, D-07, D-11).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
  getPushPublicKey: vi.fn(),
}));
vi.mock('../api/pushService', () => api);

interface FakeSubscription {
  endpoint: string;
  toJSON: () => unknown;
  unsubscribe: ReturnType<typeof vi.fn>;
}

function fakeSubscription(endpoint = 'https://fcm.googleapis.com/fcm/send/a'): FakeSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function stubBrowser(subscription: FakeSubscription | null, permission = 'granted') {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Notification', { permission });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
      }),
    },
  });
}

describe('push subscription sync', () => {
  beforeEach(() => {
    vi.resetModules();
    api.subscribePush.mockReset().mockResolvedValue(undefined);
    api.unsubscribePush.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('re-posts the existing subscription when the app opens (D-07)', async () => {
    stubBrowser(fakeSubscription());
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    expect(api.subscribePush).toHaveBeenCalledTimes(1);
    expect(api.subscribePush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: expect.any(String) }), 'en');
  });

  it('does not repeat the same sync, but re-posts on language change (D-11)', async () => {
    stubBrowser(fakeSubscription());
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    await syncPushSubscription('u1', 'en');
    expect(api.subscribePush).toHaveBeenCalledTimes(1);
    await syncPushSubscription('u1', 'pt');
    expect(api.subscribePush).toHaveBeenCalledTimes(2);
    expect(api.subscribePush).toHaveBeenLastCalledWith(expect.anything(), 'pt');
  });

  it('re-posts when another account uses the same browser (D-06)', async () => {
    stubBrowser(fakeSubscription());
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('userA', 'en');
    await syncPushSubscription('userB', 'en');
    expect(api.subscribePush).toHaveBeenCalledTimes(2);
  });

  it('force re-posts after the service worker reports a change', async () => {
    stubBrowser(fakeSubscription());
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    await syncPushSubscription('u1', 'en', true);
    expect(api.subscribePush).toHaveBeenCalledTimes(2);
  });

  it('never subscribes without permission', async () => {
    stubBrowser(fakeSubscription(), 'default');
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    expect(api.subscribePush).not.toHaveBeenCalled();
  });

  it('never subscribes when the browser has no subscription', async () => {
    stubBrowser(null);
    const { syncPushSubscription } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    expect(api.subscribePush).not.toHaveBeenCalled();
  });

  it('logout removes the backend row and the browser subscription (D-06)', async () => {
    const sub = fakeSubscription();
    stubBrowser(sub);
    const { unsubscribeThisDevice } = await import('./usePushNotifications');
    await expect(unsubscribeThisDevice()).resolves.toBe(true);
    expect(api.unsubscribePush).toHaveBeenCalledWith(sub.endpoint);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('logout still cancels the browser subscription when the API call fails', async () => {
    const sub = fakeSubscription();
    stubBrowser(sub);
    api.unsubscribePush.mockRejectedValueOnce(new Error('offline'));
    const { unsubscribeThisDevice } = await import('./usePushNotifications');
    await expect(unsubscribeThisDevice()).rejects.toThrow('offline');
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('logout with no subscription does nothing', async () => {
    stubBrowser(null);
    const { unsubscribeThisDevice } = await import('./usePushNotifications');
    await expect(unsubscribeThisDevice()).resolves.toBe(false);
    expect(api.unsubscribePush).not.toHaveBeenCalled();
  });

  it('after logout the next sync posts again', async () => {
    stubBrowser(fakeSubscription());
    const { syncPushSubscription, unsubscribeThisDevice } = await import('./usePushNotifications');
    await syncPushSubscription('u1', 'en');
    await unsubscribeThisDevice();
    await syncPushSubscription('u1', 'en');
    expect(api.subscribePush).toHaveBeenCalledTimes(2);
  });
});
