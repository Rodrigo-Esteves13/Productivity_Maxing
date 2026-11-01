import { describe, expect, it } from 'vitest';
import { IdempotentAttempt, KEY_CONFLICT, type SubmitOutcome } from './idempotency';

const counter = () => {
  let n = 0;
  return () => `key-${++n}`;
};

describe('IdempotentAttempt', () => {
  it('keeps the same key when the attempt fails and is retried', async () => {
    const attempt = new IdempotentAttempt(counter());
    const keys: string[] = [];
    await attempt.run(async (k) => {
      keys.push(k);
      return false;
    });
    await attempt.run(async (k) => {
      keys.push(k);
      return true;
    });
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('uses a new key after a success', async () => {
    const attempt = new IdempotentAttempt(counter());
    const keys: string[] = [];
    const ok = async (k: string) => {
      keys.push(k);
      return true;
    };
    await attempt.run(ok);
    await attempt.run(ok);
    expect(keys).toEqual(['key-1', 'key-2']);
  });

  it('ignores a second call while the first is in flight', async () => {
    const attempt = new IdempotentAttempt(counter());
    let calls = 0;
    let release: (value: boolean) => void = () => undefined;
    const first = attempt.run(() => {
      calls += 1;
      return new Promise<boolean>((resolve) => {
        release = resolve;
      });
    });
    expect(attempt.inFlight).toBe(true);
    expect(
      await attempt.run(async () => {
        calls += 1;
        return true;
      }),
    ).toBe(false);
    release(true);
    expect(await first).toBe(true);
    expect(calls).toBe(1);
    expect(attempt.inFlight).toBe(false);
  });

  it('regenerates the key and retries once on a 409', async () => {
    const attempt = new IdempotentAttempt(counter());
    const keys: string[] = [];
    const outcomes: SubmitOutcome[] = [KEY_CONFLICT, true];
    const ok = await attempt.run(async (k) => {
      keys.push(k);
      return outcomes.shift() ?? false;
    });
    expect(ok).toBe(true);
    expect(keys).toEqual(['key-1', 'key-2']);
  });

  it('releases the lock when the action throws', async () => {
    const attempt = new IdempotentAttempt(counter());
    await expect(
      attempt.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(attempt.inFlight).toBe(false);
  });
});
