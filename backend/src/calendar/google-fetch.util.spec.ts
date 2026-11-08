import {
  GOOGLE_MAX_RETRIES,
  GOOGLE_MAX_TIMEOUT_RETRIES,
  GOOGLE_RETRY_MAX_MS,
  googleFetch,
  retryDelayMs,
} from './google-fetch.util';

const response = (status: number, body = '', headers: HeadersInit = {}) =>
  new Response(body, { status, headers });

describe('googleFetch', () => {
  const sleep = jest.fn().mockResolvedValue(undefined);
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    sleep.mockClear();
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('retries 429 and 5xx, then returns the success', async () => {
    fetchMock
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, '{}'));
    const res = await googleFetch('https://x', {}, sleep);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a 403 only when it is a rate limit', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(403, '{"reason":"userRateLimitExceeded"}'),
      )
      .mockResolvedValueOnce(response(403, '{"reason":"forbidden"}'));
    const res = await googleFetch('https://x', {}, sleep);
    expect(res.status).toBe(403);
    // O corpo continua legivel para quem chama.
    expect(await res.text()).toContain('forbidden');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('adds a timeout signal to every attempt', async () => {
    fetchMock.mockResolvedValueOnce(response(200, '{}'));
    await googleFetch('https://x', { method: 'GET' }, sleep);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not retry a 404', async () => {
    fetchMock.mockResolvedValueOnce(response(404));
    await googleFetch('https://x', {}, sleep);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the max retries', async () => {
    fetchMock.mockResolvedValue(response(500));
    const res = await googleFetch('https://x', {}, sleep);
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(GOOGLE_MAX_RETRIES + 1);
  });

  it('retries a timeout at most GOOGLE_MAX_TIMEOUT_RETRIES times', async () => {
    const timeout = new DOMException('timed out', 'TimeoutError');
    fetchMock.mockRejectedValue(timeout);
    await expect(googleFetch('https://x', {}, sleep)).rejects.toBe(timeout);
    expect(fetchMock).toHaveBeenCalledTimes(GOOGLE_MAX_TIMEOUT_RETRIES + 1);
  });

  it('still retries other network errors up to the max', async () => {
    const network = new TypeError('fetch failed');
    fetchMock.mockRejectedValue(network);
    await expect(googleFetch('https://x', {}, sleep)).rejects.toBe(network);
    expect(fetchMock).toHaveBeenCalledTimes(GOOGLE_MAX_RETRIES + 1);
  });

  it('honours Retry-After and caps the wait', () => {
    expect(retryDelayMs(0, '2')).toBe(2000);
    expect(retryDelayMs(0, '999')).toBe(GOOGLE_RETRY_MAX_MS);
    expect(retryDelayMs(10, null, () => 0)).toBe(GOOGLE_RETRY_MAX_MS);
  });
});
