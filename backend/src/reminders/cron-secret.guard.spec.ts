import {
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';
import { CRON_SECRET_HEADER } from './reminders.constants';

const SECRET = 'segredo-de-teste';

function contextWith(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  const original = process.env.CRON_SECRET;
  const guard = new CronSecretGuard();

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('is a 404 when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(() =>
      guard.canActivate(contextWith({ [CRON_SECRET_HEADER]: SECRET })),
    ).toThrow(NotFoundException);
  });

  it('is a 401 without the header', () => {
    process.env.CRON_SECRET = SECRET;
    expect(() => guard.canActivate(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('is a 401 with a wrong secret (same and different length)', () => {
    process.env.CRON_SECRET = SECRET;
    for (const given of [`${SECRET}-x`, 'segredo-de-testX', '']) {
      expect(() =>
        guard.canActivate(contextWith({ [CRON_SECRET_HEADER]: given })),
      ).toThrow(UnauthorizedException);
    }
  });

  it('is a 401 when the header is not a single string', () => {
    process.env.CRON_SECRET = SECRET;
    expect(() =>
      guard.canActivate(contextWith({ [CRON_SECRET_HEADER]: [SECRET] })),
    ).toThrow(UnauthorizedException);
  });

  it('lets the right secret through', () => {
    process.env.CRON_SECRET = SECRET;
    expect(
      guard.canActivate(contextWith({ [CRON_SECRET_HEADER]: SECRET })),
    ).toBe(true);
  });
});
