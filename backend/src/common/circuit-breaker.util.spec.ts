import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.util';

const THRESHOLD = 3;
const OPEN_MS = 1000;

function setup(isFailure?: (error: unknown) => boolean) {
  let clock = 0;
  const logger = { warn: jest.fn(), log: jest.fn() };
  const breaker = new CircuitBreaker({
    name: 'test-client',
    failureThreshold: THRESHOLD,
    openDurationMs: OPEN_MS,
    now: () => clock,
    logger,
    isFailure,
  });
  const advance = (ms: number) => {
    clock += ms;
  };
  return { breaker, logger, advance };
}

const fail = () => Promise.reject(new Error('boom'));
const ok = () => Promise.resolve('ok');

async function tripOpen(breaker: CircuitBreaker) {
  for (let i = 0; i < THRESHOLD; i++) {
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
  }
}

describe('CircuitBreaker', () => {
  it('stays closed below the threshold and resets on success', async () => {
    const { breaker } = setup();
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    await expect(breaker.execute(ok)).resolves.toBe('ok');
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    expect(breaker.state).toBe('closed');
  });

  it('opens after N consecutive failures and fails fast', async () => {
    const { breaker, logger } = setup();
    await tripOpen(breaker);
    expect(breaker.state).toBe('open');
    expect(logger.warn).toHaveBeenCalledWith('test-client circuit open');

    const fn = jest.fn(ok);
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses the injected clock: half-open only after the open duration', async () => {
    const { breaker, advance } = setup();
    await tripOpen(breaker);
    advance(OPEN_MS - 1);
    expect(breaker.state).toBe('open');
    advance(1);
    expect(breaker.state).toBe('half-open');
  });

  it('half-open lets a single probe through and closes on success', async () => {
    const { breaker, advance, logger } = setup();
    await tripOpen(breaker);
    advance(OPEN_MS);

    let release: (value: string) => void = () => undefined;
    const probe = breaker.execute(
      () => new Promise<string>((resolve) => (release = resolve)),
    );
    // Enquanto o teste decorre, os outros falham logo.
    const other = jest.fn(ok);
    await expect(breaker.execute(other)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(other).not.toHaveBeenCalled();

    release('ok');
    await expect(probe).resolves.toBe('ok');
    expect(breaker.state).toBe('closed');
    expect(logger.log).toHaveBeenCalledWith('test-client circuit closed');
  });

  it('a failed probe reopens for another full open duration', async () => {
    const { breaker, advance } = setup();
    await tripOpen(breaker);
    advance(OPEN_MS);
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    expect(breaker.state).toBe('open');
    advance(OPEN_MS - 1);
    expect(breaker.state).toBe('open');
    advance(1);
    expect(breaker.state).toBe('half-open');
  });

  it('ignores a success from a call started before the circuit opened', async () => {
    const { breaker, advance } = setup();
    let release: (value: string) => void = () => undefined;
    const slow = breaker.execute(
      () => new Promise<string>((resolve) => (release = resolve)),
    );
    await tripOpen(breaker);
    release('ok');
    await expect(slow).resolves.toBe('ok');
    expect(breaker.state).toBe('open');
    advance(OPEN_MS - 1);
    expect(breaker.state).toBe('open');
    advance(1);
    expect(breaker.state).toBe('half-open');
  });

  it('a stale success during half-open does not close without the probe', async () => {
    const { breaker, advance } = setup();
    let release: (value: string) => void = () => undefined;
    const slow = breaker.execute(
      () => new Promise<string>((resolve) => (release = resolve)),
    );
    await tripOpen(breaker);
    advance(OPEN_MS);
    expect(breaker.state).toBe('half-open');
    release('ok');
    await slow;
    expect(breaker.state).toBe('half-open');
    await expect(breaker.execute(ok)).resolves.toBe('ok');
    expect(breaker.state).toBe('closed');
  });

  it('ignores a failure from a call started before the circuit opened', async () => {
    const { breaker, advance } = setup();
    let reject: (error: Error) => void = () => undefined;
    const slow = breaker.execute(
      () => new Promise<string>((_, rej) => (reject = rej)),
    );
    await tripOpen(breaker);
    advance(OPEN_MS);
    expect(breaker.state).toBe('half-open');
    reject(new Error('late'));
    await expect(slow).rejects.toThrow('late');
    expect(breaker.state).toBe('half-open');
  });

  it('errors that are not provider failures do not open the circuit', async () => {
    const { breaker } = setup(() => false);
    for (let i = 0; i < THRESHOLD * 2; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('boom');
    }
    expect(breaker.state).toBe('closed');
  });

  it('counts results flagged by isFailureResult as failures', async () => {
    const { breaker } = setup();
    for (let i = 0; i < THRESHOLD; i++) {
      await breaker.execute(() => Promise.resolve('quota'), {
        isFailureResult: (r) => r === 'quota',
      });
    }
    expect(breaker.state).toBe('open');
  });
});
