// Acoes em massa feitas com os endpoints de um so registo.

// Pedidos em simultaneo em cada lote.
export const BATCH_CONCURRENCY = 5;
// Registos por acao com um pedido cada: fica abaixo dos limites por minuto do
// backend (60 escritas de flashcards, 100 por rota no resto).
export const BULK_ACTION_MAX = 50;
// Tasks apagadas em massa que ainda tem "Anular": o TASK_BULK_MAX do backend
// (a reposicao vai em lotes por POST /tasks/bulk-restore).
export const TASK_UNDO_MAX = 200;

export interface BatchOutcome<T, R> {
  done: { item: T; value: R }[];
  failed: T[];
}

// Corre `run` por cada item, `size` de cada vez. Uma falha nao para o resto.
export async function settleInBatches<T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>,
  size: number = BATCH_CONCURRENCY,
): Promise<BatchOutcome<T, R>> {
  const outcome: BatchOutcome<T, R> = { done: [], failed: [] };
  for (let start = 0; start < items.length; start += size) {
    const batch = items.slice(start, start + size);
    const results = await Promise.allSettled(batch.map((item) => run(item)));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') outcome.done.push({ item: batch[index], value: result.value });
      else outcome.failed.push(batch[index]);
    });
  }
  return outcome;
}
