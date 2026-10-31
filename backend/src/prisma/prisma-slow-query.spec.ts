import { getSlowQueryThresholdMs, logIfSlowQuery } from './prisma.service';

describe('logIfSlowQuery', () => {
  const event = (duration: number, query = 'SELECT 1') => ({ query, duration });

  it('warns above the threshold', () => {
    const logger = { warn: jest.fn() };
    expect(logIfSlowQuery(logger, event(501), 500)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('501ms'));
  });

  it('stays silent at or below the threshold', () => {
    const logger = { warn: jest.fn() };
    expect(logIfSlowQuery(logger, event(500), 500)).toBe(false);
    expect(logIfSlowQuery(logger, event(12), 500)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('truncates very long SQL', () => {
    const logger = { warn: jest.fn() };
    logIfSlowQuery(logger, event(900, 'x'.repeat(5000)), 500);
    expect((logger.warn.mock.calls as string[][])[0][0].length).toBeLessThan(
      400,
    );
  });
});

describe('getSlowQueryThresholdMs', () => {
  it.each([
    [undefined, 500],
    ['', 500],
    ['abc', 500],
    ['-5', 500],
    ['0', 500],
    ['250', 250],
  ])('%s -> %s', (raw, expected) => {
    expect(getSlowQueryThresholdMs(raw)).toBe(expected);
  });
});
