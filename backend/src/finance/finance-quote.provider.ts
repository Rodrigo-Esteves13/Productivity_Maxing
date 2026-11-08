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
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../common/circuit-breaker.util';
import {
  QUOTE_BREAKER_FAILURE_THRESHOLD,
  QUOTE_BREAKER_OPEN_MS,
  isProviderFailureStatus,
} from '../common/http-resilience.constants';

const QUOTE_CLIENT_NAME = 'Yahoo quotes';

/** Resposta HTTP nao-OK do fornecedor (so o codigo, nunca o corpo). */
class QuoteHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

// So falhas do fornecedor abrem o circuito: um 404 de simbolo desconhecido
// e uma resposta valida e nao conta.
const isQuoteProviderFailure = (error: unknown) =>
  !(error instanceof QuoteHttpError) || isProviderFailureStatus(error.status);

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
 * Com o Yahoo em baixo o circuito abre e os pedidos devolvem null logo (o
 * FinancePricesService mantem o ultimo preco guardado).
 */
@Injectable()
export class YahooQuoteProvider implements QuoteProvider {
  private readonly logger = new Logger(YahooQuoteProvider.name);
  private readonly breaker = new CircuitBreaker({
    name: QUOTE_CLIENT_NAME,
    failureThreshold: QUOTE_BREAKER_FAILURE_THRESHOLD,
    openDurationMs: QUOTE_BREAKER_OPEN_MS,
    isFailure: isQuoteProviderFailure,
  });

  async fetchQuote(symbol: string): Promise<Quote | null> {
    if (!isValidQuoteSymbol(symbol)) return null;
    try {
      const body = await this.breaker.execute(async () => {
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
        if (!res.ok) throw new QuoteHttpError(res.status);
        return (await res.json()) as ChartResponse;
      });
      return parseChartQuote(symbol, body, new Date());
    } catch (err) {
      // Circuito aberto: a mudanca de estado ja ficou no log uma vez.
      if (err instanceof CircuitOpenError) return null;
      if (err instanceof QuoteHttpError) {
        this.logger.warn(`Quote ${symbol} failed with HTTP ${err.status}`);
        return null;
      }
      // So a mensagem: o objeto de erro pode trazer cabecalhos.
      this.logger.warn(
        `Quote ${symbol} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
