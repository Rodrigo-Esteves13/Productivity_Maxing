import { FinancePricesService } from './finance-prices.service';
import { YahooQuoteProvider } from './finance-quote.provider';
import {
  QUOTE_BREAKER_FAILURE_THRESHOLD,
  QUOTE_BREAKER_OPEN_MS,
} from '../common/http-resilience.constants';
import type { PrismaService } from '../prisma/prisma.service';

const chart = (price: number) =>
  new Response(
    JSON.stringify({
      chart: {
        result: [{ meta: { regularMarketPrice: price, currency: 'EUR' } }],
      },
    }),
    { status: 200 },
  );

describe('YahooQuoteProvider circuit breaker', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    jest.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') });
  });
  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
  });

  async function tripOpen(provider: YahooQuoteProvider) {
    fetchMock.mockRejectedValue(new Error('timeout'));
    for (let i = 0; i < QUOTE_BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(provider.fetchQuote('VWCE.DE')).resolves.toBeNull();
    }
    fetchMock.mockClear();
  }

  it('returns null without calling Yahoo while open, then probes again', async () => {
    const provider = new YahooQuoteProvider();
    await tripOpen(provider);

    await expect(provider.fetchQuote('VWCE.DE')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(QUOTE_BREAKER_OPEN_MS);
    fetchMock.mockResolvedValueOnce(chart(100));
    await expect(provider.fetchQuote('VWCE.DE')).resolves.toMatchObject({
      priceCents: 10000,
    });
  });

  it('unknown symbols (404) never open the circuit', async () => {
    const provider = new YahooQuoteProvider();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('', { status: 404 })),
    );
    for (let i = 0; i < QUOTE_BREAKER_FAILURE_THRESHOLD * 2; i++) {
      await provider.fetchQuote('NOPE');
    }
    expect(fetchMock).toHaveBeenCalledTimes(
      QUOTE_BREAKER_FAILURE_THRESHOLD * 2,
    );
  });

  it('FinancePricesService keeps the cached price while the circuit is open', async () => {
    const provider = new YahooQuoteProvider();
    const prisma = { financeHolding: {} } as unknown as PrismaService;
    const prices = new FinancePricesService(prisma, provider);

    fetchMock.mockResolvedValueOnce(chart(168.4));
    const first = await prices.quoteFor('VWCE.DE', true);
    expect(first?.priceCents).toBe(16840);

    await tripOpen(provider);
    await expect(prices.quoteFor('VWCE.DE', true)).resolves.toEqual(first);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
