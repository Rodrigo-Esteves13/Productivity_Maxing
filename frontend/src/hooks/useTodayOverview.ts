import { useEffect, useRef, useState } from 'react';
import { getTodayTasks } from '../api/studySessionsService';
import { getSchedule } from '../api/scheduleService';
import { getWorkShiftRange } from '../api/workShiftsService';
import { getStudyPlan } from '../api/studyPlanService';
import { cachedQuery, type QueryOptions } from '../api/queryCache';
import { mergeAgenda, type AgendaItem } from '../lib/agenda';
import { toDateKey } from '../lib/dateKey';
import { todayUtcAnchored } from '../lib/weekDates';
import type { StudyPlanSuggestion, Task } from '../types/models';

// So o dia de hoje: o plano de estudo e o pedido mais pesado, e aqui so
// interessam os blocos de hoje.
const STUDY_PLAN_DAYS = 1;

// O cartao "Hoje" e o resumo diario montam ao mesmo tempo no Dashboard e
// pedem exatamente o mesmo (F-09): partilham um so resultado durante 30 s.
// Qualquer escrita limpa a cache (ver mutationInvalidation.ts).
const TODAY_FRESH_MS = 30_000;

export interface TodayOverview {
  dueToday: Task[];
  agenda: AgendaItem[];
  studyBlocks: StudyPlanSuggestion[];
}

const TODAY_QUERY: QueryOptions<TodayOverview> = {
  freshMs: TODAY_FRESH_MS,
  staleMs: TODAY_FRESH_MS,
  clone: (overview) => structuredClone(overview),
};

const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

// Tudo falhou: nao fica em cache (o proximo pedido tenta de novo).
class TodayOverviewUnavailable extends Error {}

async function fetchTodayOverview(dateKey: string, signal: AbortSignal): Promise<TodayOverview> {
  const [due, classes, shifts, plan] = await Promise.allSettled([
    getTodayTasks(),
    getSchedule(dateKey, dateKey, signal),
    getWorkShiftRange(dateKey, dateKey),
    getStudyPlan(STUDY_PLAN_DAYS, signal),
  ]);
  if ([due, classes, shifts, plan].every((result) => result.status === 'rejected')) {
    throw new TodayOverviewUnavailable();
  }
  return {
    dueToday: valueOr(due, []),
    // Aula desmarcada (professor faltou) nao entra no "hoje".
    agenda: mergeAgenda(
      valueOr(classes, []).filter((c) => !c.cancelled),
      valueOr(shifts, []),
    ),
    studyBlocks: plan.status === 'fulfilled' ? plan.value.suggestions : [],
  };
}

// Marca "ainda nao correu" (undefined e null sao chaves validas).
const NOT_RUN = Symbol('not-run');

// Dados do cartao "Hoje": tasks que vencem hoje (/tasks/today), aulas e
// turnos de hoje e os blocos de estudo do plano. Cada parte e best-effort:
// se uma falhar o cartao mostra as outras; se falharem todas fica null e o
// cartao nao aparece (como o StudyCapacityCard).
// `refreshKey` (opcional): quando muda, volta a pedir em silencio (o cartao
// mantem o que tinha), sempre a rede. O digest diario nao o passa: so le uma
// vez, e reaproveita o pedido do cartao.
export function useTodayOverview(refreshKey?: string | null) {
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const lastKey = useRef<string | null | undefined | typeof NOT_RUN>(NOT_RUN);

  useEffect(() => {
    const controller = new AbortController();
    const dateKey = toDateKey(todayUtcAnchored());
    // Primeira leitura (ou a mesma chave outra vez, ex: StrictMode): pode
    // vir da cache. Chave nova: os dados mudaram, vai a rede.
    const force = lastKey.current !== NOT_RUN && lastKey.current !== refreshKey;
    lastKey.current = refreshKey;
    cachedQuery(`today|${dateKey}`, (signal) => fetchTodayOverview(dateKey, signal), TODAY_QUERY, {
      signal: controller.signal,
      force,
    }).then(
      (result) => {
        if (!controller.signal.aborted) setOverview(result);
      },
      () => {
        // Falhou tudo ou foi cancelado: fica o que havia.
      },
    );
    return () => controller.abort();
  }, [refreshKey]);

  return overview;
}
