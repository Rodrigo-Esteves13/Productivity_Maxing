// Silent-bug audit (area d). EXPECTED TO FAIL while the bugs exist.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lisbonTodayKey } from '../lib/dateKey';

// Runs public/push-sw.js against a fake service worker global and returns
// the options it passes to showNotification for one push payload.
async function showOptionsForPush(payload: Record<string, unknown>) {
  const source = readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8');
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const fakeSelf = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([]) },
    location: { origin: 'https://app.example.test' },
  };
  new Function('self', source)(fakeSelf);
  let waited: Promise<unknown> = Promise.resolve();
  handlers.push({
    data: { json: () => payload },
    waitUntil: (p: Promise<unknown>) => {
      waited = p;
    },
  });
  await waited;
  return showNotification.mock.calls[0][1] as NotificationOptions & { renotify?: boolean };
}

describe('notifications (silent-audit, area d)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // D-03: push-sw.js reuses the message key as the tag ("medicationDue").
  // A second notification with the same tag replaces the one still in the
  // tray and, without renotify: true, the browser shows it WITHOUT sound or
  // vibration (Notifications API: "renotify" defaults to false).
  it('D-03: a tagged push re-alerts when it replaces an older one', async () => {
    const options = await showOptionsForPush({
      title: 'Medication reminder',
      body: 'Time for a dose you planned.',
      url: '/wellbeing',
      tag: 'medicationDue',
    });
    expect(options.tag).toBe('medicationDue');
    expect(options.renotify).toBe(true);
  });

  // D-04 (sibling of the known Focus bug, in the uncommitted fix): Focus
  // alerts use one fixed tag plus requireInteraction: true, so the block-end
  // alert stays in the tray and the break-end alert replaces it silently.
  it('D-04: Focus alerts re-alert when they replace the previous one', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ active: {}, showNotification }) },
    });
    const { notify } = await import('../lib/focusAlerts');
    notify('Break over', 'Ready for the next block?');
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalled());
    const options = showNotification.mock.calls[0][1] as NotificationOptions & { renotify?: boolean };
    expect(options.requireInteraction).toBe(true);
    expect(options.renotify).toBe(true);
  });

  // D-05: useMedications / useMoodToday key "today" with todayKey(), which is
  // the UTC date. The backend keys medication doses, reminders and the
  // default checklist day by the Lisbon calendar day (getLisbonNow). In
  // summer, 00:00-00:59 Lisbon is still "yesterday" in UTC.
  it('D-05: the day key used by the wellbeing hooks matches the Lisbon day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z')); // 00:30 on 16 July in Lisbon
    const lisbonDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(lisbonDay).toBe('2026-07-16');
    // The wellbeing hooks key "today" with lisbonTodayKey() (rule 2 in
    // lib/dateKey.ts). todayKey() is now the browser-local day for the rest
    // of the UI, so the assertion targets the helper the hooks really use.
    expect(lisbonTodayKey()).toBe(lisbonDay);
  });
});
