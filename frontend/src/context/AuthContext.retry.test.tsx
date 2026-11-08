// Startup session check retries only transient errors. The project has no DOM
// library (jsdom / testing-library), so React hooks are replaced by a tiny
// in-memory shim and AuthProvider is called as a plain function.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  fetchCsrfToken: vi.fn(),
  logoutRequest: vi.fn(),
}));
vi.mock('../api/userService', () => api);
vi.mock('../api/csrfStore', () => ({ setCsrfToken: vi.fn(), setSessionUserId: vi.fn() }));
vi.mock('../hooks/usePushNotifications', () => ({ unsubscribeThisDevice: vi.fn() }));
vi.mock('../pwa/pushPromptStorage', () => ({ clearPushPromptAnswered: vi.fn() }));
vi.mock('../hooks/useCalendarStatus', () => ({ resetCalendarStatus: vi.fn() }));

interface Harness {
  slots: unknown[];
  idx: number;
  effects: (() => void)[];
  rendering: boolean;
  render: () => void;
}
const h = vi.hoisted(
  () => ({ slots: [], idx: 0, effects: [], rendering: false, render: () => {} }) as Harness,
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const depsChanged = (a?: unknown[], b?: unknown[]) =>
    !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
  const shim = {
    useState<T>(init: T) {
      const i = h.idx++;
      if (!h.slots[i]) {
        const cell = { v: init } as { v: T; set: (n: T) => void };
        cell.set = (n: T) => {
          if (Object.is(cell.v, n)) return;
          cell.v = n;
          if (!h.rendering) h.render();
        };
        h.slots[i] = cell;
      }
      const cell = h.slots[i] as { v: T; set: (n: T) => void };
      return [cell.v, cell.set];
    },
    useRef<T>(init: T) {
      const i = h.idx++;
      h.slots[i] ??= { current: init };
      return h.slots[i];
    },
    useMemo<T>(fn: () => T, deps: unknown[]) {
      const i = h.idx++;
      const s = h.slots[i] as { v: T; deps: unknown[] } | undefined;
      if (s && !depsChanged(s.deps, deps)) return s.v;
      h.slots[i] = { v: fn(), deps };
      return (h.slots[i] as { v: T }).v;
    },
    useCallback<T>(fn: T, deps: unknown[]) {
      return shim.useMemo(() => fn, deps);
    },
    useEffect(fn: () => void, deps?: unknown[]) {
      const i = h.idx++;
      const s = h.slots[i] as { deps: unknown[] } | undefined;
      if (!s || depsChanged(s.deps, deps)) {
        h.slots[i] = { deps };
        h.effects.push(fn);
      }
    },
  };
  return { ...actual, ...shim, default: { ...actual, ...shim } };
});

import { AuthProvider } from './AuthContext';

interface AuthValue {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: { id: string } | null;
  login: (csrfToken: string) => void;
}
let current: AuthValue;

function mount() {
  h.slots = [];
  h.effects = [];
  h.render = () => {
    h.rendering = true;
    h.idx = 0;
    const el = AuthProvider({ children: null }) as unknown as { props: { value: AuthValue } };
    current = el.props.value;
    h.rendering = false;
    const run = h.effects.splice(0);
    run.forEach((fn) => fn());
  };
  h.render();
}

describe('AuthProvider startup session retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    api.fetchCsrfToken.mockReset();
    api.getUserProfile.mockReset().mockResolvedValue({ id: 'u1' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a network error once and ends authenticated', async () => {
    api.fetchCsrfToken
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce('csrf-token');
    mount();
    expect(current.isAuthLoading).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(api.fetchCsrfToken).toHaveBeenCalledTimes(2);
    expect(current.isAuthenticated).toBe(true);
    expect(current.isAuthLoading).toBe(false);
  });

  it('does not retry a plain Error and ends unauthenticated', async () => {
    api.fetchCsrfToken.mockRejectedValue(new Error('Not authenticated'));
    mount();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(api.fetchCsrfToken).toHaveBeenCalledTimes(1);
    expect(current.isAuthenticated).toBe(false);
    expect(current.isAuthLoading).toBe(false);
  });

  it('a recheck while the startup check retries reuses it (one check at a time)', async () => {
    api.fetchCsrfToken
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce('csrf-token');
    mount();
    const recheck = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      ([type]) => type === 'visibilitychange',
    )?.[1] as () => void;
    recheck();
    recheck();

    await vi.advanceTimersByTimeAsync(1000);

    expect(api.fetchCsrfToken).toHaveBeenCalledTimes(2);
    expect(current.isAuthenticated).toBe(true);
  });

  it('a stale failing check does not log out a login that happened meanwhile', async () => {
    api.fetchCsrfToken
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockRejectedValueOnce(new Error('Not authenticated'));
    mount();
    current.login('fresh-token');
    expect(current.isAuthenticated).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(current.isAuthenticated).toBe(true);
    expect(current.user).toEqual({ id: 'u1' });
    expect(current.isAuthLoading).toBe(false);
  });

  it('retries a transient profile error (503) and then loads the user', async () => {
    api.fetchCsrfToken.mockResolvedValue('csrf-token');
    api.getUserProfile
      .mockReset()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ id: 'u1' });
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(current.isAuthenticated).toBe(true);
    expect(current.user).toBeNull();

    await vi.advanceTimersByTimeAsync(1000);

    expect(api.getUserProfile).toHaveBeenCalledTimes(2);
    expect(current.user).toEqual({ id: 'u1' });
  });
});
