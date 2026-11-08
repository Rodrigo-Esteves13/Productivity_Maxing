import { Logger } from '@nestjs/common';

// Circuit breaker pequeno para clientes HTTP externos chamados muitas vezes
// (Distance Matrix, cotacoes, web push). Fechado: os pedidos passam. Depois
// de `failureThreshold` falhas seguidas abre: durante `openDurationMs` todos
// os pedidos falham logo com CircuitOpenError, sem tocar na rede. Passado
// esse tempo fica meio-aberto: deixa passar UM pedido de teste; sucesso
// fecha, falha volta a abrir. Uma instancia por cliente.

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerLogger {
  warn(message: string): void;
  log(message: string): void;
}

export interface CircuitBreakerOptions {
  /** Nome curto do cliente, so para logs e para o erro. */
  name: string;
  failureThreshold: number;
  openDurationMs: number;
  /** Relogio injetavel (testes). Por omissao Date.now. */
  now?: () => number;
  logger?: CircuitBreakerLogger;
  /**
   * Que erros contam como falha do fornecedor. Os outros (ex: morada sem
   * rota, simbolo desconhecido) passam para quem chama sem abrir o circuito.
   */
  isFailure?: (error: unknown) => boolean;
}

export interface ExecuteOptions<T> {
  /** Resposta que chegou mas conta como falha (ex: quota esgotada). */
  isFailureResult?: (result: T) => boolean;
}

/** Lancado sem fazer o pedido enquanto o circuito esta aberto. */
export class CircuitOpenError extends Error {
  constructor(readonly client: string) {
    super(`${client} circuit is open`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private currentState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  // Sobe a cada abertura. Um pedido que comecou antes da ultima abertura
  // (epoca antiga) ja nao diz nada sobre o fornecedor agora: o resultado dele
  // e ignorado, senao um sucesso atrasado fechava o circuito sem esperar
  // openDurationMs nem passar pelo pedido de teste.
  private openEpoch = 0;
  private probeInFlight = false;
  private readonly now: () => number;
  private readonly logger: CircuitBreakerLogger;
  private readonly isFailure: (error: unknown) => boolean;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? (() => Date.now());
    this.logger = options.logger ?? new Logger(CircuitBreaker.name);
    this.isFailure = options.isFailure ?? (() => true);
  }

  get state(): CircuitState {
    if (
      this.currentState === 'open' &&
      this.now() - this.openedAt >= this.options.openDurationMs
    ) {
      this.transition('half-open');
    }
    return this.currentState;
  }

  async execute<T>(
    fn: () => Promise<T>,
    execOptions: ExecuteOptions<T> = {},
  ): Promise<T> {
    const state = this.state;
    if (state === 'open' || (state === 'half-open' && this.probeInFlight)) {
      throw new CircuitOpenError(this.options.name);
    }
    const isProbe = state === 'half-open';
    if (isProbe) this.probeInFlight = true;
    const epoch = this.openEpoch;
    const record = (failed: boolean) => {
      if (epoch !== this.openEpoch) return;
      if (failed) this.onFailure();
      else this.onSuccess();
    };
    try {
      let result: T;
      try {
        result = await fn();
      } catch (error) {
        record(this.isFailure(error));
        throw error;
      }
      record(execOptions.isFailureResult?.(result) ?? false);
      return result;
    } finally {
      if (isProbe) this.probeInFlight = false;
    }
  }

  private onSuccess() {
    this.consecutiveFailures = 0;
    if (this.currentState !== 'closed') this.transition('closed');
  }

  private onFailure() {
    this.consecutiveFailures++;
    if (
      this.currentState === 'half-open' ||
      (this.currentState === 'closed' &&
        this.consecutiveFailures >= this.options.failureThreshold)
    ) {
      this.openedAt = this.now();
      this.openEpoch++;
      this.transition('open');
    }
  }

  private transition(next: CircuitState) {
    this.currentState = next;
    const message = `${this.options.name} circuit ${next}`;
    if (next === 'open') this.logger.warn(message);
    else this.logger.log(message);
  }
}
