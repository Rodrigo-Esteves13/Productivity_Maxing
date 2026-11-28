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

  it('never logs the query arguments of a validation error', () => {
    const err = new Prisma.PrismaClientValidationError(
      '\nInvalid `prisma.user.update()` invocation:\n\n{ data: { email: "victim@example.test", note: "segredo" } }\n\nInvalid value',
      { clientVersion: 'test' },
    );
    const { logged } = runLogged(err);
    expect(logged).toContain('Invalid `prisma.user.update()` invocation');
    expect(logged).not.toContain('victim@example.test');
    expect(logged).not.toContain('segredo');
  });

  it('a 500 logs the code and stack frames, not the message', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Raw query failed. Detail: Key (email)=(victim@example.test)',
      { code: 'P2010', clientVersion: 'test', meta: { modelName: 'User' } },
    );
    const { logged } = runLogged(err);
    expect(logged).toContain('P2010 User');
    expect(logged).not.toContain('victim@example.test');
  });
});

function runLogged(exception: unknown) {
  const status = jest.fn().mockReturnValue({ json: jest.fn() });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const filter = new PrismaExceptionFilter();
  const logger = (
    filter as unknown as {
      logger: { warn: (m: string) => void; error: (...m: unknown[]) => void };
    }
  ).logger;
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
  return { logged };
}
