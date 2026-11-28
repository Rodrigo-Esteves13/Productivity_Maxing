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
  it('cancels the network request only when every caller with a signal gave up', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const network = vi.fn((config: InternalAxiosRequestConfig) => {
      signals.push(config.signal as AbortSignal | undefined);
      return new Promise<AxiosResponse>(() => undefined);
    });
    const adapter = dedupeGets(network, (config) => config.url ?? '');
    const one = new AbortController();
    const two = new AbortController();
    const a = adapter(request('/tasks', { signal: one.signal }));
    const b = adapter(request('/tasks', { signal: two.signal }));
    one.abort();
    expect(signals[0]?.aborted).toBe(false);
    two.abort();
    expect(signals[0]?.aborted).toBe(true);
    await expect(a).rejects.toSatisfy(isCancel);
    await expect(b).rejects.toSatisfy(isCancel);
    // O pedido seguinte ja nao se junta ao cancelado.
    void adapter(request('/tasks'));
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('never cancels the network request while a caller without a signal waits', () => {
    const signals: (AbortSignal | undefined)[] = [];
    const network = vi.fn((config: InternalAxiosRequestConfig) => {
      signals.push(config.signal as AbortSignal | undefined);
      return new Promise<AxiosResponse>(() => undefined);
    });
    const adapter = dedupeGets(network, (config) => config.url ?? '');
    const controller = new AbortController();
    void adapter(request('/tasks')).catch(() => undefined);
    void adapter(request('/tasks', { signal: controller.signal })).catch(() => undefined);
    controller.abort();
    expect(signals[0]?.aborted).toBe(false);
  });
});
