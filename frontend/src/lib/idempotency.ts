// Chaves de idempotencia dos pedidos de criacao (Idempotency-Key).
// Uma chave por tentativa de criar: o retry da mesma tentativa reutiliza-a
// (o backend devolve a linha ja criada) e so uma criacao com sucesso gera outra.

/** Resultado de um pedido de criacao: sucesso, falha (retry) ou chave ja usada (409). */
export const KEY_CONFLICT = 'KEY_CONFLICT' as const;
export type SubmitOutcome = boolean | typeof KEY_CONFLICT;

export function newRequestId(): string {
  return crypto.randomUUID();
}

export class IdempotentAttempt {
  private key: string | null = null;
  private busy = false;

  private readonly makeId: () => string;

  constructor(makeId: () => string = newRequestId) {
    this.makeId = makeId;
  }

  get inFlight(): boolean {
    return this.busy;
  }

  private currentKey(): string {
    this.key ??= this.makeId();
    return this.key;
  }

  /**
   * Corre a criacao com a chave da tentativa. Um segundo clique enquanto o
   * primeiro corre devolve false sem pedido. Em 409 gera chave nova e repete uma vez.
   */
  async run(action: (key: string) => Promise<SubmitOutcome>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      let outcome = await action(this.currentKey());
      if (outcome === KEY_CONFLICT) {
        this.key = null;
        outcome = await action(this.currentKey());
      }
      if (outcome === true || outcome === KEY_CONFLICT) this.key = null;
      return outcome === true;
    } finally {
      this.busy = false;
    }
  }
}
