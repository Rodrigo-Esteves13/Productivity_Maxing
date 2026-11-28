// Barramento unico de avisos entre partes da app que nao partilham contexto
// nem props (cartoes do Social, avaliacoes, modais globais). Tipado: cada
// nome tem o seu payload em BusEvents. So em memoria, cada separador tem o
// seu. Os dados com versao por dominio ficam em lib/domainEvents.ts.
import type { Task } from '../types/models';

export interface BusEvents {
  // Algo pendente no Social mudou (aceitou/recusou um pedido ou convite):
  // contadores e listas voltam a ler sem esperar pelo polling.
  'social:changed': void;
  // A nota do docente mudou nesta cadeira: o servidor copia-a para as outras
  // cadeiras do mesmo docente, que voltam a ler.
  'areaRatings:teacherChanged': { areaId: string };
  // Tasks concluidas fora do prazo: abrir a pergunta "acabaste a tempo?".
  'tasks:askOnTime': Task[];
  // A resposta foi gravada: as listas abertas trocam a task pela nova.
  'tasks:onTimeSaved': Task;
  // Algo que o Google Calendar devia refletir mudou. force = abrir o modal
  // mesmo sem alteracoes (botao manual).
  'calendar:syncReview': { force: boolean };
}

export type BusEventName = keyof BusEvents;
export type BusListener<K extends BusEventName> = (payload: BusEvents[K]) => void;
type EmitArgs<K extends BusEventName> = BusEvents[K] extends void ? [] : [payload: BusEvents[K]];

const listeners = new Map<BusEventName, Set<BusListener<BusEventName>>>();

function listenersFor<K extends BusEventName>(name: K): Set<BusListener<K>> {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  // O Map guarda todos os nomes juntos; cada Set so recebe ouvintes do seu.
  return set as unknown as Set<BusListener<K>>;
}

// Subscreve um aviso. Devolve o cancelamento.
export function on<K extends BusEventName>(name: K, listener: BusListener<K>): () => void {
  const set = listenersFor(name);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

// Entrega sincrona, como os eventos de janela que substitui: quem subscreve
// durante a entrega so recebe o proximo, quem cancela durante a entrega ja
// nao recebe este, e um erro num ouvinte nao impede os outros.
export function emit<K extends BusEventName>(name: K, ...args: EmitArgs<K>): void {
  const set = listenersFor(name);
  const payload = args[0] as BusEvents[K];
  for (const listener of [...set]) {
    if (!set.has(listener)) continue;
    try {
      listener(payload);
    } catch (error) {
      // Continua visivel na consola e na telemetria de erros globais.
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}
