import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  API_KEY_HEADER,
  ApiKeyFailureTracker,
  guardApiKeyFailures,
} from './api-key-failure.tracker';
import {
  API_KEY_FAILURE_MAX_TRACKED_IPS,
  API_KEY_FAILURE_WINDOW_MS,
  API_KEY_MAX_FAILURES_PER_WINDOW,
} from './dto/auth-limits';

const IP = '203.0.113.7';

function contextFor(headers: Record<string, string>, ip = IP) {
  const req = { ip, headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function failTimes(tracker: ApiKeyFailureTracker, n: number, ip = IP) {
  for (let i = 0; i < n; i += 1) tracker.recordFailure(ip);
}

describe('ApiKeyFailureTracker (S-09)', () => {
  it('blocks an IP once it reaches the failure ceiling', () => {
    const tracker = new ApiKeyFailureTracker(() => 0);
    failTimes(tracker, API_KEY_MAX_FAILURES_PER_WINDOW - 1);
    expect(tracker.isBlocked(IP)).toBe(false);
    tracker.recordFailure(IP);
    expect(tracker.isBlocked(IP)).toBe(true);
    expect(tracker.isBlocked('198.51.100.1')).toBe(false);
  });

  it('forgets the failures when the window ends', () => {
    let now = 0;
    const tracker = new ApiKeyFailureTracker(() => now);
    failTimes(tracker, API_KEY_MAX_FAILURES_PER_WINDOW);
    now = API_KEY_FAILURE_WINDOW_MS;
    expect(tracker.isBlocked(IP)).toBe(false);
  });

  it('stays bounded in memory', () => {
    const tracker = new ApiKeyFailureTracker(() => 0);
    for (let i = 0; i <= API_KEY_FAILURE_MAX_TRACKED_IPS; i += 1) {
      tracker.recordFailure(`ip-${i}`);
    }
    expect(tracker.trackedIps).toBe(API_KEY_FAILURE_MAX_TRACKED_IPS);
  });
});

describe('guardApiKeyFailures', () => {
  it('ignores requests without x-api-key (JWT only)', async () => {
    const tracker = new ApiKeyFailureTracker(() => 0);
    failTimes(tracker, API_KEY_MAX_FAILURES_PER_WINDOW);
    const activate = jest.fn().mockRejectedValue(new UnauthorizedException());
    await expect(
      guardApiKeyFailures(contextFor({}), activate, tracker),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('counts an invalid key and answers 429 without running the strategy once over the ceiling', async () => {
    const tracker = new ApiKeyFailureTracker(() => 0);
    const ctx = contextFor({ [API_KEY_HEADER]: 'bad' });
    const activate = jest.fn().mockRejectedValue(new UnauthorizedException());
    for (let i = 0; i < API_KEY_MAX_FAILURES_PER_WINDOW; i += 1) {
      await expect(
        guardApiKeyFailures(ctx, activate, tracker),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const err: unknown = await guardApiKeyFailures(
      ctx,
      activate,
      tracker,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    // O scrypt vive dentro da strategy: nao correu no pedido bloqueado.
    expect(activate).toHaveBeenCalledTimes(API_KEY_MAX_FAILURES_PER_WINDOW);
  });

  it('does not count a successful key', async () => {
    const tracker = new ApiKeyFailureTracker(() => 0);
    const ctx = contextFor({ [API_KEY_HEADER]: 'good' });
    const activate = jest.fn().mockResolvedValue(true);
    await expect(guardApiKeyFailures(ctx, activate, tracker)).resolves.toBe(
      true,
    );
    expect(tracker.trackedIps).toBe(0);
  });
});
