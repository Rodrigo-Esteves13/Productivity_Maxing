import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type {
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { LoggingThrottlerGuard } from './logging-throttler.guard';
import type {
  RecordSecurityEventInput,
  SecurityLogsService,
} from '../../security-logs/security-logs.service';

// Silent audit (area e): blocked requests that arrive less than 5s after the
// last flush for the same ip+path are kept in `pending` and only written on
// a LATER 429 for that same key. When a burst ends inside the 5s window,
// those blocked requests never reach the SecurityLog table, so the admin
// Security page undercounts the attack.

class TestableGuard extends LoggingThrottlerGuard {
  hit(context: ExecutionContext) {
    return this.throwThrottlingException(context, {
      tracker: '203.0.113.7',
    } as ThrottlerLimitDetail);
  }
}

function context(): ExecutionContext {
  const req = {
    originalUrl: '/auth/login',
    method: 'POST',
    headers: { 'user-agent': 'burst' },
    ip: '203.0.113.7',
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('LoggingThrottlerGuard aggregation (E-07)', () => {
  afterEach(() => jest.useRealTimers());

  it('persists every blocked request of a short burst', async () => {
    jest.useFakeTimers();
    const recorded: RecordSecurityEventInput[] = [];
    const logs = {
      recordEvent: jest.fn((input: RecordSecurityEventInput) => {
        recorded.push(input);
        return Promise.resolve();
      }),
    } as unknown as SecurityLogsService;
    const guard = new TestableGuard(
      {} as ThrottlerModuleOptions,
      {} as ThrottlerStorage,
      {} as Reflector,
      logs,
    );

    // 50 blocked requests in the same instant, then the attacker stops.
    for (let i = 0; i < 50; i++) {
      await guard.hit(context()).catch(() => undefined);
    }
    // A agregacao em janelas de 5s e intencional (protege o pool da BD):
    // o resto da rajada e gravado quando a janela fecha, sem precisar de
    // outro 429 para a mesma chave.
    jest.advanceTimersByTime(5000);

    const persisted = recorded.reduce((sum, r) => sum + (r.count ?? 1), 0);
    expect(persisted).toBe(50);
  });
});
