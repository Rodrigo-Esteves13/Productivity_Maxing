import { Logger } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('reportClientError strips query and hash from url, uses stack as trace', () => {
    new TelemetryService().reportClientError({
      message: 'boom',
      url: 'https://app.test/tasks?token=abc#secret',
      stack: 'STACK',
      componentStack: 'COMP',
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, trace, ctx] = errorSpy.mock.calls[0] as string[];
    expect(msg).toBe('Client error: boom (/tasks)');
    expect(msg).not.toContain('abc');
    expect(trace).toBe('STACK');
    expect(ctx).toBe('ClientError');
  });

  it('reportClientError falls back to componentStack', () => {
    new TelemetryService().reportClientError({
      message: 'm',
      url: '/x',
      componentStack: 'COMP',
    });
    expect((errorSpy.mock.calls[0] as string[])[1]).toBe('COMP');
  });

  it('reportClientError redacts secret path segments', () => {
    new TelemetryService().reportClientError({
      message: 'm',
      url: '/shared/SECRETTOKEN',
    });
    expect((errorSpy.mock.calls[0] as string[])[0]).not.toContain(
      'SECRETTOKEN',
    );
  });

  it('reportClientError handles an unparsable url', () => {
    expect(() =>
      new TelemetryService().reportClientError({
        message: 'm',
        url: 'http://[bad',
      }),
    ).not.toThrow();
    expect((errorSpy.mock.calls[0] as string[])[0]).toContain('[invalid url]');
  });

  it('reportWebVital logs metric with sanitized url', () => {
    new TelemetryService().reportWebVital({
      name: 'LCP',
      value: 1234,
      id: 'v1-1',
      url: '/packs/CODE123?x=1',
    } as never);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [msg, ctx] = logSpy.mock.calls[0] as string[];
    expect(msg).toContain('LCP=1234');
    expect(msg).toContain('id=v1-1');
    expect(msg).not.toContain('CODE123');
    expect(ctx).toBe('WebVitals');
  });
});
