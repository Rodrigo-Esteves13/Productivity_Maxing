import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('./client', () => ({ default: { get: vi.fn() } }));

import api from './client';
import { fetchAllPages, MAX_PAGES, PAGE_LIMIT } from './fetchAllPages';

const get = vi.mocked(api.get);
const page = (ids: string[], nextCursor: string | null) =>
  ({ data: { items: ids.map((id) => ({ id })), nextCursor } }) as never;
const badRequest = () =>
  new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
  } as never);

describe('fetchAllPages', () => {
  beforeEach(() => get.mockReset());

  it('single page: one request, items returned', async () => {
    get.mockResolvedValueOnce(page(['a', 'b'], null));
    const result = await fetchAllPages('/tasks', { periodId: 'all' });
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]?.params).toEqual({
      periodId: 'all',
      paginated: true,
      limit: PAGE_LIMIT,
    });
  });

  it('multi page: follows cursors and concatenates in order', async () => {
    get
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockResolvedValueOnce(page(['b'], 'c2'))
      .mockResolvedValueOnce(page(['c'], null));
    const result = await fetchAllPages('/tasks');
    expect(result.map((r) => (r as { id: string }).id)).toEqual(['a', 'b', 'c']);
    expect(get.mock.calls[1][1]?.params).toMatchObject({ cursor: 'c1' });
    expect(get.mock.calls[2][1]?.params).toMatchObject({ cursor: 'c2' });
  });

  it('safety cap: stops after MAX_PAGES requests', async () => {
    let n = 0;
    get.mockImplementation(() => {
      n += 1;
      return Promise.resolve(page([`x${n}`], 'again'));
    });
    const result = await fetchAllPages('/tasks');
    expect(get).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result).toHaveLength(MAX_PAGES);
  });

  it('error mid-way propagates', async () => {
    get.mockResolvedValueOnce(page(['a'], 'c1')).mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAllPages('/tasks')).rejects.toThrow('boom');
  });

  it('invalid cursor (400): restarts from page one once, no duplicates', async () => {
    get
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockRejectedValueOnce(badRequest())
      .mockResolvedValueOnce(page(['a', 'b'], null));
    const result = await fetchAllPages('/tasks');
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(get.mock.calls[2][1]?.params).not.toHaveProperty('cursor');
  });

  it('second invalid cursor after the restart propagates', async () => {
    get
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockRejectedValueOnce(badRequest())
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockRejectedValueOnce(badRequest());
    await expect(fetchAllPages('/tasks')).rejects.toBeInstanceOf(AxiosError);
  });

  it('a row that moved between pages (data changed mid-read) is returned once', async () => {
    get
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockResolvedValueOnce(page(['b', 'c'], null));
    const result = await fetchAllPages('/tasks');
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('abort: the signal reaches every page request and the cancel propagates', async () => {
    const controller = new AbortController();
    get.mockResolvedValueOnce(page(['a'], 'c1')).mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new AxiosError('canceled', 'ERR_CANCELED'));
    });
    await expect(fetchAllPages('/tasks', {}, controller.signal)).rejects.toMatchObject({
      code: 'ERR_CANCELED',
    });
    expect(get.mock.calls[0][1]?.signal).toBe(controller.signal);
    expect(get.mock.calls[1][1]?.signal).toBe(controller.signal);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('400 on the first page (no cursor) propagates', async () => {
    get.mockRejectedValueOnce(badRequest());
    await expect(fetchAllPages('/tasks')).rejects.toBeInstanceOf(AxiosError);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
