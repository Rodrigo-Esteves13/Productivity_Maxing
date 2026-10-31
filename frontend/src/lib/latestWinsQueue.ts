// Serializa escritas por chave (areaId + campo): corre uma de cada vez, pela
// ordem de chegada, e salta as que ja foram substituidas por uma mais recente
// antes de comecarem. Assim o servidor acaba sempre com o ultimo valor e uma
// resposta antiga nunca chega depois de uma nova.
export type QueueOutcome = 'done' | 'superseded';

export function createLatestWinsQueue() {
  const tails = new Map<string, Promise<unknown>>();
  const latest = new Map<string, number>();
  let seq = 0;

  return function enqueue(key: string, task: () => Promise<void>): Promise<QueueOutcome> {
    const mine = ++seq;
    latest.set(key, mine);
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async (): Promise<QueueOutcome> => {
        if (latest.get(key) !== mine) return 'superseded';
        await task();
        return 'done';
      });
    const tail = run.catch(() => undefined).then(() => {
      if (tails.get(key) === tail) {
        tails.delete(key);
        latest.delete(key);
      }
    });
    tails.set(key, tail);
    return run;
  };
}
