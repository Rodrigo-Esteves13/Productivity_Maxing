import { FinancePricesService } from './finance-prices.service';
import {
  isValidQuoteSymbol,
  parseChartQuote,
  type Quote,
  type QuoteProvider,
} from './finance-quote.provider';
import { MAX_AMOUNT_CENTS, MAX_DB_INT } from './finance.constants';
import type { PrismaService } from '../prisma/prisma.service';

const quote = (symbol: string): Quote => ({
  symbol,
  priceCents: 16840,
  currency: 'EUR',
  fetchedAt: new Date('2026-11-01T10:00:00Z'),
});

function setup(fetchQuote: QuoteProvider['fetchQuote']) {
  const prisma = {
    financeHolding: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { symbol: 'VWCE.DE' },
          { symbol: 'BTC-EUR' },
          { symbol: 'BAD.X' },
        ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const provider = { fetchQuote: jest.fn(fetchQuote) };
  return {
    prisma,
    provider,
    service: new FinancePricesService(
      prisma as unknown as PrismaService,
      provider,
    ),
  };
}

describe('FinancePricesService', () => {
  it('cron survives a provider that throws or returns nothing', async () => {
    const { service, prisma } = setup((symbol) => {
      if (symbol === 'BAD.X') return Promise.reject(new Error('boom'));
      if (symbol === 'BTC-EUR') return Promise.resolve(null);
      return Promise.resolve(quote(symbol));
    });
    await expect(service.refreshAll()).resolves.toEqual({
      updated: ['VWCE.DE'],
      failed: ['BTC-EUR', 'BAD.X'],
    });
    // Falhas nao apagam o ultimo preco: so ha escrita para quem teve quote.
    expect(prisma.financeHolding.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.financeHolding.updateMany).toHaveBeenCalledWith({
      where: { symbol: 'VWCE.DE' },
      data: {
        lastPriceCents: 16840,
        priceCurrency: 'EUR',
        priceUpdatedAt: quote('VWCE.DE').fetchedAt,
      },
    });
  });

  it('cron never rejects when the database is down', async () => {
    const { service, prisma } = setup(() => Promise.resolve(null));
    prisma.financeHolding.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.refreshAll()).resolves.toEqual({
      updated: [],
      failed: [],
    });
  });

  it('manual refresh is scoped to the user and reuses a recent quote', async () => {
    const { service, prisma, provider } = setup((s) =>
      Promise.resolve(quote(s)),
    );
    prisma.financeHolding.findMany.mockResolvedValue([{ symbol: 'VWCE.DE' }]);
    await service.refreshForUser('me');
    await service.refreshForUser('me');
    expect(provider.fetchQuote).toHaveBeenCalledTimes(1);
    expect(prisma.financeHolding.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: 'me', symbol: 'VWCE.DE' } }),
    );
    expect(prisma.financeHolding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'me' } }),
    );
  });

  it('never calls the provider with an invalid symbol', async () => {
    const { service, provider } = setup((s) => Promise.resolve(quote(s)));
    await expect(service.quoteFor('../etc')).resolves.toBeNull();
    expect(provider.fetchQuote).not.toHaveBeenCalled();
  });
});

describe('quote parsing and symbol rules', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  const body = (price: number, currency = 'USD') => ({
    chart: { result: [{ meta: { regularMarketPrice: price, currency } }] },
  });

  it('drops a price that does not fit the Int column', () => {
    // BTC-KRW ronda 1.4e8 KRW: em centimos passa o teto do int4.
    expect(
      parseChartQuote('BTC-KRW', body(140_000_000, 'KRW'), now),
    ).toBeNull();
    expect(parseChartQuote('AAPL', body(230.5), now)).toEqual(
      expect.objectContaining({ priceCents: 23050, currency: 'USD' }),
    );
  });

  it('rejects symbols made only of punctuation', () => {
    expect(isValidQuoteSymbol('..')).toBe(false);
    expect(isValidQuoteSymbol('.')).toBe(false);
    expect(isValidQuoteSymbol('^GSPC')).toBe(true);
    expect(isValidQuoteSymbol('BTC-EUR')).toBe(true);
  });

  it('keeps amounts inside the Postgres Int range', () => {
    expect(MAX_AMOUNT_CENTS).toBeLessThanOrEqual(MAX_DB_INT);
  });
});
