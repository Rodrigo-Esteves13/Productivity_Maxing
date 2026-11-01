import { Injectable, Logger } from '@nestjs/common';
import {
  CENTS_PER_UNIT,
  MAX_DB_INT,
  QUOTE_MINOR_UNIT_CURRENCIES,
  QUOTE_PROVIDER_BASE_URL,
  QUOTE_SYMBOL_PATTERN,
  QUOTE_TIMEOUT_MS,
  QUOTE_USER_AGENT,
} from './finance.constants';

export interface Quote {
  symbol: string;
  /** Preco de uma unidade inteira, em centimos de `currency`. */
  priceCents: number;
  currency: string;
  fetchedAt: Date;
}

/** Fornecedor de cotacoes. Nunca rejeita: devolve null quando falha. */
export interface QuoteProvider {
  fetchQuote(symbol: string): Promise<Quote | null>;
}

export const QUOTE_PROVIDER = Symbol('QUOTE_PROVIDER');

export const isValidQuoteSymbol = (symbol: string) =>
  QUOTE_SYMBOL_PATTERN.test(symbol);

// So os campos que lemos do endpoint chart.
interface ChartResponse {
  chart?: {
    result?: { meta?: { regularMarketPrice?: unknown; currency?: unknown } }[];
  };
}

/** Le preco e moeda da resposta do Yahoo. Exportado para testes. */
export function parseChartQuote(
  symbol: string,
  body: ChartResponse,
  now: Date,
): Quote | null {
  const meta = body.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const rawCurrency = meta?.currency;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (typeof rawCurrency !== 'string') return null;
  // Bolsas que cotam em subunidades (GBp = pence) passam para a moeda base.
  const minor = QUOTE_MINOR_UNIT_CURRENCIES[rawCurrency];
  const currency = (minor?.currency ?? rawCurrency).toUpperCase();
  const unitPrice = price / (minor?.divisor ?? 1);
  const priceCents = Math.round(unitPrice * CENTS_PER_UNIT);
  // lastPriceCents e Int: um preco maior (BTC-KRW) rebentava a escrita.
  // 0 depois de arredondar daria divisao por zero em investedCents.
  if (priceCents < 1 || priceCents > MAX_DB_INT) return null;
  return {
    symbol,
    priceCents,
    currency,
    fetchedAt: now,
  };
}

/**
 * Yahoo Finance chart endpoint (publico, sem chave). Host fixo e simbolo
 * validado por regex antes de entrar no caminho: nao ha SSRF. Sem
 * redirects, com timeout. Qualquer falha fica no log como aviso curto.
 */
@Injectable()
export class YahooQuoteProvider implements QuoteProvider {
  private readonly logger = new Logger(YahooQuoteProvider.name);

  async fetchQuote(symbol: string): Promise<Quote | null> {
    if (!isValidQuoteSymbol(symbol)) return null;
    try {
      const res = await fetch(
        `${QUOTE_PROVIDER_BASE_URL}${encodeURIComponent(symbol)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': QUOTE_USER_AGENT,
          },
          redirect: 'error',
          signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Quote ${symbol} failed with HTTP ${res.status}`);
        return null;
      }
      return parseChartQuote(
        symbol,
        (await res.json()) as ChartResponse,
        new Date(),
      );
    } catch (err) {
      // So a mensagem: o objeto de erro pode trazer cabecalhos.
      this.logger.warn(
        `Quote ${symbol} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
