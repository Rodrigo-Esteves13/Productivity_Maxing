import { describe, expect, it, vi } from 'vitest';
import { AxiosHeaders, isCancel, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { dedupeGets } from './dedupeGets';

const request = (url: string, extra: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig => ({
  url,
  method: 'get',
  headers: new AxiosHeaders(),
  ...extra,
});

function fakeNetwork() {
  const resolvers: ((response: AxiosResponse) => void)[] = [];
  const network = vi.fn(
    (config: InternalAxiosRequestConfig) =>
      new Promise<AxiosResponse>((resolve) => {
        resolvers.push(() => resolve({ data: `"${config.url}"`, status: 200, statusText: 'OK', headers: {}, config }));
      }),
  );
  const flush = () => resolvers.splice(0).forEach((resolve) => resolve({} as AxiosResponse));
  return { network, flush };
}

describe('dedupeGets', () => {
  it('shares one network request between identical GETs in flight', async () => {
    const { network, flush } = fakeNetwork();
    const adapter = dedupeGets(network, (config) => config.url ?? '');
    const first = adapter(request('/heatmap'));
    const second = adapter(request('/heatmap'));
    flush();
    const [a, b] = await Promise.all([first, second]);
    expect(network).toHaveBeenCalledTimes(1);
    expect(a.data).toBe('"/heatmap"');
    // Cada um com a sua resposta e o seu config.
    expect(a).not.toBe(b);
  });

  it('asks again once the first request finished, and never shares writes', async () => {
    const { network, flush } = fakeNetwork();
    const adapter = dedupeGets(network, (config) => config.url ?? '');
    const first = adapter(request('/tasks'));
    flush();
    await first;
    const again = adapter(request('/tasks'));
    const writeA = adapter(request('/tasks', { method: 'post' }));
    const writeB = adapter(request('/tasks', { method: 'post' }));
    flush();
    await Promise.all([again, writeA, writeB]);
    expect(network).toHaveBeenCalledTimes(4);
  });

  it('cancels only the caller that aborted', async () => {
    const { network, flush } = fakeNetwork();
    const adapter = dedupeGets(network, (config) => config.url ?? '');
    const controller = new AbortController();
    const aborted = adapter(request('/history', { signal: controller.signal }));
    const kept = adapter(request('/history'));
    controller.abort();
    flush();
    await expect(aborted).rejects.toSatisfy(isCancel);
    await expect(kept).resolves.toMatchObject({ status: 200 });
    expect(network).toHaveBeenCalledTimes(1);
  });
});
