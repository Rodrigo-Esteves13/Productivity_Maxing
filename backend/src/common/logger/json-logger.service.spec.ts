import { runWithRequestId } from '../request-context';
import { JsonLogger } from './json-logger.service';

describe('JsonLogger requestId', () => {
  let out: jest.SpyInstance;
  let err: jest.SpyInstance;

  beforeEach(() => {
    out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    err = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('adds requestId inside a request scope', () => {
    runWithRequestId('req-abc-12345', () => new JsonLogger().log('hi', 'Ctx'));
    const line = JSON.parse(
      String((out.mock.calls as unknown[][])[0][0]),
    ) as Record<string, unknown>;
    expect(line).toMatchObject({ message: 'hi', requestId: 'req-abc-12345' });
  });

  it('omits requestId outside a request scope', () => {
    new JsonLogger().warn('boot', 'Ctx');
    const line = JSON.parse(
      String((err.mock.calls as unknown[][])[0][0]),
    ) as Record<string, unknown>;
    expect(line.requestId).toBeUndefined();
  });
});
