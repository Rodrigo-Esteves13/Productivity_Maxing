import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { dedupeGets } from './dedupeGets';
import { invalidateOnWrite } from './mutationInvalidation';
import { clearQueryCache, receiveBroadcastForTests, resetQueryCacheForTests } from './queryCache';

// Um GET que partiu antes de uma escrita (ou do logout) nao serve a leituras
// pedidas depois.
function setup() {
  const pending: { method: string; resolve: () => void; reject: () => void }[] = [];
  const network = vi.fn(
    (config: InternalAxiosRequestConfig) =>
      new Promise<AxiosResponse>((resolve, reject) => {
        pending.push({
          method: config.method ?? 'get',
          resolve: () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
          reject: () => reject(new Error('boom')),
        });
      }),
  );
  const adapter: AxiosAdapter = invalidateOnWrite(dedupeGets(network, (config) => config.url ?? ''));
  const send = (method: string, url: string) =>
    Promise.resolve(adapter({ method, url } as InternalAxiosRequestConfig));
  const gets = () => pending.filter((request) => request.method === 'get').length;
  return { send, gets, pending };
}

describe('in-flight GETs are not shared across writes or logout', () => {
  beforeEach(() => resetQueryCacheForTests());

  // '/notebook' e neutra para a cache, mas muda os proprios GETs.
  it.each(['/tasks', '/notebook/entries'])('a read after a write to %s starts a new request', (url) => {
    const { send, gets } = setup();
    void send('get', url);
    void send('patch', url);
    void send('get', url);
    expect(gets()).toBe(2);
  });

  it.each(['/tasks', '/notebook/entries'])('a read after the write to %s ends does not join one started during it', async (url) => {
    const { send, gets, pending } = setup();
    const write = send('post', url);
    void send('get', url);
    pending[0].resolve();
    await write;
    void send('get', url);
    expect(gets()).toBe(2);
  });

  it('a failed write also drops the reads started during it', async () => {
    const { send, gets, pending } = setup();
    const write = send('post', '/tasks');
    void send('get', '/tasks');
    pending[0].reject();
    await expect(write).rejects.toThrow('boom');
    void send('get', '/tasks');
    expect(gets()).toBe(2);
  });

  it('logout (clearQueryCache) drops them', () => {
    const { send, gets } = setup();
    void send('get', '/auth/me');
    clearQueryCache({ broadcast: false });
    void send('get', '/auth/me');
    expect(gets()).toBe(2);
  });

  it.each(['invalidate', 'clear'] as const)('a %s message from another tab drops them', (message) => {
    const { send, gets } = setup();
    void send('get', '/tasks');
    receiveBroadcastForTests(message);
    void send('get', '/tasks');
    expect(gets()).toBe(2);
  });

  it('identical reads with nothing in between still share one request', () => {
    const { send, gets } = setup();
    void send('get', '/tasks');
    void send('get', '/tasks');
    expect(gets()).toBe(1);
  });
});
