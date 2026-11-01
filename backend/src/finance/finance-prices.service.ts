import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import {
  QUOTE_PROVIDER,
  isValidQuoteSymbol,
  type Quote,
  type QuoteProvider,
} from './finance-quote.provider';
import {
  MAX_SYMBOLS_PER_PRICE_RUN,
  QUOTE_CONCURRENCY,
  QUOTE_MIN_REFRESH_MS,
} from './finance.constants';

export interface PriceRefreshResult {
  /** Simbolos com preco atualizado (pedido novo ou cache recente). */
  updated: string[];
  /** Simbolos em que o fornecedor falhou (fica o ultimo preco guardado). */
  failed: string[];
}

/**
 * Precos das posicoes. O cron corre de hora a hora nesta instancia; o
 * refresh manual reaproveita a cache: cada simbolo vai ao fornecedor no
 * maximo uma vez por QUOTE_MIN_REFRESH_MS (sucesso ou falha). Nada aqui
 * lanca erro para fora: uma falha mantem o ultimo preco guardado.
 */
@Injectable()
export class FinancePricesService {
  private readonly logger = new Logger(FinancePricesService.name);
  private readonly cache = new Map<string, Quote>();
  private readonly lastAttempt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUOTE_PROVIDER) private readonly provider: QuoteProvider,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshAll(): Promise<PriceRefreshResult> {
    try {
      // Job de sistema: precos sao publicos, por isso este e o unico sitio
      // que le e escreve posicoes de todos os users (so campos de preco).
      const rows = await this.prisma.financeHolding.findMany({
        distinct: ['symbol'],
        select: { symbol: true },
        orderBy: { symbol: 'asc' },
        take: MAX_SYMBOLS_PER_PRICE_RUN,
      });
      return await this.refresh(
        rows.map((r) => r.symbol),
        {},
        true,
      );
    } catch (err) {
      this.logger.error(
        `Price cron failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return { updated: [], failed: [] };
    }
  }

  /** Refresh manual: so os simbolos e as linhas desta pessoa. */
  async refreshForUser(userId: string): Promise<PriceRefreshResult> {
    const rows = await this.prisma.financeHolding.findMany({
      where: { userId },
      distinct: ['symbol'],
      select: { symbol: true },
    });
    return this.refresh(
      rows.map((r) => r.symbol),
      { userId },
      false,
    );
  }

  /** Quote em cache recente ou pedido novo (usado ao criar uma posicao). */
  async quoteFor(symbol: string, force = false): Promise<Quote | null> {
    if (!isValidQuoteSymbol(symbol)) return null;
    const now = Date.now();
    const cached = this.cache.get(symbol);
    const last = this.lastAttempt.get(symbol) ?? 0;
    if (!force && now - last < QUOTE_MIN_REFRESH_MS) return cached ?? null;
    this.lastAttempt.set(symbol, now);
    try {
      const quote = await this.provider.fetchQuote(symbol);
      if (quote) this.cache.set(symbol, quote);
      return quote ?? cached ?? null;
    } catch (err) {
      // O contrato diz que nunca rejeita; protege na mesma.
      this.logger.warn(
        `Quote ${symbol} threw: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private async refresh(
    symbols: string[],
    scope: { userId?: string },
    force: boolean,
  ): Promise<PriceRefreshResult> {
    const results = await runWithConcurrencyLimit(
      symbols,
      QUOTE_CONCURRENCY,
      async (symbol) => {
        try {
          const quote = await this.quoteFor(symbol, force);
          if (!quote) return { symbol, ok: false };
          await this.prisma.financeHolding.updateMany({
            where: { ...scope, symbol },
            data: {
              lastPriceCents: quote.priceCents,
              priceCurrency: quote.currency,
              priceUpdatedAt: quote.fetchedAt,
            },
          });
          return { symbol, ok: true };
        } catch (err) {
          this.logger.warn(
            `Price update ${symbol} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
          return { symbol, ok: false };
        }
      },
    );
    return {
      updated: results.filter((r) => r.ok).map((r) => r.symbol),
      failed: results.filter((r) => !r.ok).map((r) => r.symbol),
    };
  }
}
