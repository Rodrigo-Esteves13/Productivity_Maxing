import type { NextFunction, Request, Response } from 'express';
import { getRequestId } from '../request-context';
import {
  REQUEST_ID_HEADER,
  requestIdMiddleware,
  resolveRequestId,
} from './request-id.middleware';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function run(headerValue?: unknown) {
  const setHeader = jest.fn();
  let seenInside: string | undefined;
  const next: NextFunction = () => {
    seenInside = getRequestId();
  };
  requestIdMiddleware(
    { headers: { [REQUEST_ID_HEADER]: headerValue } } as unknown as Request,
    { setHeader } as unknown as Response,
    next,
  );
  return { setHeader, seenInside };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when the client sends no header', () => {
    const { setHeader, seenInside } = run(undefined);
    const id = (setHeader.mock.calls as string[][])[0][1];
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(id).toMatch(UUID_RE);
    expect(seenInside).toBe(id);
  });

  it('reuses a valid client-supplied id', () => {
    const { setHeader, seenInside } = run('client-req-12345');
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'client-req-12345',
    );
    expect(seenInside).toBe('client-req-12345');
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['whitespace / newline', 'abc def\nghi-12345'],
    ['array header', ['one-valid-id-1', 'two-valid-id-2']],
  ])('replaces an unsafe id (%s)', (_label, bad) => {
    const { setHeader, seenInside } = run(bad);
    const id = (setHeader.mock.calls as string[][])[0][1];
    expect(id).toMatch(UUID_RE);
    expect(seenInside).toBe(id);
  });

  it('gives each request its own id', () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });

  it('does not leak the id outside the request scope', () => {
    run('client-req-12345');
    expect(getRequestId()).toBeUndefined();
  });

  it('propagates through async boundaries', async () => {
    let afterAwait: string | undefined;
    const next: NextFunction = () => {
      void Promise.resolve()
        .then(() => new Promise((r) => setTimeout(r, 5)))
        .then(() => {
          afterAwait = getRequestId();
        });
    };
    requestIdMiddleware(
      {
        headers: { [REQUEST_ID_HEADER]: 'async-req-12345' },
      } as unknown as Request,
      { setHeader: jest.fn() } as unknown as Response,
      next,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(afterAwait).toBe('async-req-12345');
  });
});
