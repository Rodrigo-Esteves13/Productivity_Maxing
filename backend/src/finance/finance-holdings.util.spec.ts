import { FinanceAccountType } from '@prisma/client';
import {
  holdingBucket,
  holdingMetrics,
  quantityFromInvested,
} from './finance-holdings.util';
import { parseChartQuote } from './finance-quote.provider';

describe('holdings math', () => {
  it('derives a fractional quantity from the invested amount', () => {
    // 112,18 EUR de VWCE.DE com uma unidade a 168,40 EUR.
    expect(quantityFromInvested(11218, 16840)).toBe('0.666152');
  });

  it('value, gain and percent of a full share', () => {
    const m = holdingMetrics({
      quantity: '0.666152',
      lastPriceCents: 17000,
      costBasisCents: 11218,
    });
    expect(m).toEqual({
      quantity: '0.666152',
      valueCents: 11325,
      gainCents: 107,
      gainPercent: 0.95,
      fullSharePriceCents: 17000,
      percentOfFullShare: 66.62,
    });
  });

  it('no price means no value nor gain', () => {
    const m = holdingMetrics({
      quantity: '2',
      lastPriceCents: null,
      costBasisCents: 500,
    });
    expect(m.valueCents).toBeNull();
    expect(m.gainCents).toBeNull();
    expect(m.percentOfFullShare).toBe(200);
  });

  it('buckets by linked account, else crypto pattern, else investment', () => {
    expect(holdingBucket('VWCE.DE', FinanceAccountType.BANK)).toBe('BANK');
    expect(holdingBucket('BTC-EUR', null)).toBe('CRYPTO');
    expect(holdingBucket('VWCE.DE', null)).toBe('INVESTMENT');
  });
});

describe('parseChartQuote', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  const body = (price: unknown, currency: unknown) => ({
    chart: { result: [{ meta: { regularMarketPrice: price, currency } }] },
  });

  it('reads price and currency', () => {
    expect(parseChartQuote('VWCE.DE', body(168.4, 'EUR'), now)).toEqual({
      symbol: 'VWCE.DE',
      priceCents: 16840,
      currency: 'EUR',
      fetchedAt: now,
    });
  });

  it('converts pence quotes to pounds', () => {
    expect(parseChartQuote('VUSA.L', body(8150, 'GBp'), now)?.priceCents).toBe(
      8150,
    );
    expect(parseChartQuote('VUSA.L', body(8150, 'GBp'), now)?.currency).toBe(
      'GBP',
    );
  });

  it('rejects malformed payloads', () => {
    expect(parseChartQuote('X', body('1', 'EUR'), now)).toBeNull();
    expect(parseChartQuote('X', body(-1, 'EUR'), now)).toBeNull();
    expect(parseChartQuote('X', body(1, undefined), now)).toBeNull();
    expect(parseChartQuote('X', {}, now)).toBeNull();
  });
});
