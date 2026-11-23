import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function run(exception: unknown) {
  const json = jest.fn<void, [{ message: string }]>();
  const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({
    json,
  });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const filter = new PrismaExceptionFilter();
  const logger = (
    filter as unknown as {
      logger: { warn: () => void; error: () => void };
    }
  ).logger;
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return {
    status: status.mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`email`)',
    { code, clientVersion: 'test' },
  );
}

describe('PrismaExceptionFilter (S-14)', () => {
  it('P2025 -> 404', () => {
    expect(run(known('P2025')).status).toBe(404);
  });

  it('P2002 -> 409', () => {
    expect(run(known('P2002')).status).toBe(409);
  });

  it('P2003 -> 409', () => {
    expect(run(known('P2003')).status).toBe(409);
  });

  it('PrismaClientValidationError -> 400', () => {
    const err = new Prisma.PrismaClientValidationError('Invalid Date', {
      clientVersion: 'test',
    });
    expect(run(err).status).toBe(400);
  });

  it('other codes stay a generic 500', () => {
    expect(run(known('P2034')).status).toBe(500);
  });

  it('never leaks the Prisma detail to the client', () => {
    const { body } = run(known('P2002'));
    expect(body.message).not.toContain('email');
    expect(body.message).not.toContain('constraint');
  });
});
