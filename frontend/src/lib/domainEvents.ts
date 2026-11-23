// Versao por dominio de dados, para cartoes que buscam por conta propria
// saberem que outro sitio da app mudou esses dados (o bug do Wellbeing:
// apagar uma sessao ou concluir uma task deixava anel, streak e previsoes
// desatualizados ate F5). Quem escreve chama notifyDomainChanged depois de
// a escrita correr bem (os servicos em api/ ja o fazem); quem le usa
// useDomainKey (hooks/useDomainVersion.ts) como refreshKey do seu fetch.
//
// Varias escritas seguidas (ex: concluir 20 tasks uma a uma) juntam-se num
// so aviso depois de DOMAIN_CHANGE_SETTLE_MS, para os cartoes nao pedirem
// os dados 20 vezes. Estado so em memoria: cada separador tem o seu.

export type DataDomain = 'tasks' | 'studySessions' | 'grades' | 'areaTeachers' | 'ratings';

export const DATA_DOMAINS: readonly DataDomain[] = ['tasks', 'studySessions', 'grades', 'areaTeachers', 'ratings'];

// Janela para juntar escritas seguidas num so aviso.
export const DOMAIN_CHANGE_SETTLE_MS = 250;

type Listener = () => void;

const published: Record<DataDomain, number> = { tasks: 0, studySessions: 0, grades: 0, areaTeachers: 0, ratings: 0 };
const pending = new Set<DataDomain>();
const listeners = new Set<Listener>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  if (pending.size === 0) return;
  for (const domain of pending) published[domain] += 1;
  pending.clear();
  for (const listener of [...listeners]) listener();
}

// Marca os dominios como mudados. O aviso sai uma vez, no fim da janela.
export function notifyDomainChanged(...domains: DataDomain[]): void {
  if (domains.length === 0) return;
  for (const domain of domains) pending.add(domain);
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, DOMAIN_CHANGE_SETTLE_MS);
}

// Versao atual de um dominio (sobe 1 por cada aviso).
export function getDomainVersion(domain: DataDomain): number {
  return published[domain];
}

// Soma das versoes de varios dominios. So cresce, por isso serve de chave:
// muda sempre que algum deles muda.
export function getDomainsVersion(domains: readonly DataDomain[]): number {
  let total = 0;
  for (const domain of domains) total += published[domain];
  return total;
}

// Chamado depois de cada aviso (qualquer dominio). Devolve o cancelamento.
export function subscribeToDomainChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// So para testes: volta ao estado inicial.
export function resetDomainEventsForTests(): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = null;
  pending.clear();
  listeners.clear();
  for (const domain of DATA_DOMAINS) published[domain] = 0;
}

// Combinacoes usadas por varios cartoes (constantes: o hook nao recria arrays).
export const TASK_DOMAINS: readonly DataDomain[] = ['tasks'];
export const GRADE_DOMAINS: readonly DataDomain[] = ['tasks', 'grades'];
export const PLAN_DOMAINS: readonly DataDomain[] = ['tasks', 'studySessions'];
export const FORECAST_DOMAINS: readonly DataDomain[] = ['tasks', 'grades', 'studySessions'];
export const RATING_DOMAINS: readonly DataDomain[] = ['ratings'];
export const AREA_OVERVIEW_DOMAINS: readonly DataDomain[] = ['tasks', 'grades', 'areaTeachers'];
