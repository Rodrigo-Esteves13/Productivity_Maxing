// Contas das posicoes (ETF, acoes, cripto) com fracoes de unidade. Usa o
// Decimal do Prisma (decimal.js) para nao perder casas com floats.

import { FinanceAccountType, Prisma } from '@prisma/client';
import {
  CRYPTO_SYMBOL_PATTERN,
  PERCENT_DECIMALS,
  PERCENT_SCALE,
  QUANTITY_DECIMALS,
} from './finance.constants';

const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | string | number;

/** Quantidade comprada com `investedCents` a `priceCents` por unidade. */
export function quantityFromInvested(
  investedCents: number,
  priceCents: number,
): string {
  return new Decimal(investedCents)
    .div(priceCents)
    .toDecimalPlaces(QUANTITY_DECIMALS)
    .toFixed(QUANTITY_DECIMALS);
}

export interface HoldingMetrics {
  /** Texto decimal com 6 casas (ex.: "0.666152"). */
  quantity: string;
  /** quantity x lastPriceCents, arredondado. null sem preco. */
  valueCents: number | null;
  gainCents: number | null;
  gainPercent: number | null;
  /** Preco de uma unidade inteira (o mesmo que lastPriceCents). */
  fullSharePriceCents: number | null;
  /** Quanto de uma unidade inteira se tem (0.666152 => 66.62). */
  percentOfFullShare: number;
}

const toPercent = (value: Prisma.Decimal) =>
  value.times(PERCENT_SCALE).toDecimalPlaces(PERCENT_DECIMALS).toNumber();

export function holdingMetrics(holding: {
  quantity: DecimalLike;
  lastPriceCents: number | null;
  costBasisCents: number | null;
}): HoldingMetrics {
  const quantity = new Decimal(holding.quantity);
  const price = holding.lastPriceCents;
  const valueCents =
    price === null ? null : quantity.times(price).toDecimalPlaces(0).toNumber();
  const cost = holding.costBasisCents;
  const gainCents =
    valueCents === null || cost === null ? null : valueCents - cost;
  return {
    quantity: quantity.toFixed(QUANTITY_DECIMALS),
    valueCents,
    gainCents,
    gainPercent:
      gainCents === null || !cost
        ? null
        : toPercent(new Decimal(gainCents).div(cost)),
    fullSharePriceCents: price,
    percentOfFullShare: toPercent(quantity),
  };
}

/**
 * Balde onde o valor de uma posicao soma: o tipo da conta ligada; sem
 * conta, CRYPTO para simbolos BASE-MOEDA (BTC-EUR) e INVESTMENT no resto.
 */
export function holdingBucket(
  symbol: string,
  accountType: FinanceAccountType | null,
): FinanceAccountType {
  if (accountType) return accountType;
  return CRYPTO_SYMBOL_PATTERN.test(symbol)
    ? FinanceAccountType.CRYPTO
    : FinanceAccountType.INVESTMENT;
}
