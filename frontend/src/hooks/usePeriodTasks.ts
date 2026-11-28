import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserTasks } from '../api/tasksService';
import { subscribeToRevalidatedTasks } from '../api/catalogCache';
import type { Task } from '../types/models';
import { isRequestCanceled } from '../lib/abortable';
import * as bus from '../lib/bus';

interface LoadedPeriod {
  period: string | undefined;
}

// As tasks do periodo escolhido (Dashboard e pagina Tasks).
// - So o primeiro carregamento (ou depois de um erro) mostra isLoading.
// - Ao mudar de periodo, as tasks antigas ficam no ecra com isStale=true ate
//   chegarem as novas. Enquanto isStale, quem as mostra tem de bloquear as
//   acoes (ver components/UI/StaleRegion): nao sao do periodo escolhido.
// - Se a lista veio de uma copia velha da cache, a revalidada entra sem
//   esqueleto. Uma escrita pelo meio solta essa revalidacao (queryCache.ts),
//   por isso nunca pisa uma mudanca local mais nova.
// - Um pedido falhado apaga a lista: dados de outro periodo nunca ficam a
//   passar pelos do novo.
export function usePeriodTasks(periodParam: string | undefined, isAcademicLoading: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState<LoadedPeriod | null>(null);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const periodRef = useRef(periodParam);
  const refreshRef = useRef<AbortController | null>(null);

  // Enquanto o AcademicContext nao resolve, periodParam e undefined: esperar
  // evita um fetch inutil (e deitado fora).
  useEffect(() => {
    periodRef.current = periodParam;
    if (isAcademicLoading) return;
    // Mudar de periodo cancela o pedido anterior: uma resposta lenta do
    // periodo antigo nunca pode pisar a do periodo novo.
    const controller = new AbortController();
    setHasError(false);
    async function load() {
      try {
        const data = await getUserTasks(periodParam, controller.signal);
        if (controller.signal.aborted) return;
        setTasks(data);
        setLoaded({ period: periodParam });
      } catch (error) {
        if (controller.signal.aborted || isRequestCanceled(error)) return;
        console.error('Failed to load tasks', error);
        setTasks([]);
        setLoaded(null);
        setHasError(true);
      }
    }
    // Antes do pedido: a copia velha e a revalidacao dela partem juntas.
    const unsubscribe = subscribeToRevalidatedTasks(periodParam, setTasks);
    void load();
    return () => {
      unsubscribe();
      controller.abort();
      refreshRef.current?.abort();
    };
  }, [periodParam, isAcademicLoading, attempt]);

  // "Acabaste a tempo?" respondido: as listas e a taxa de prazos mudam logo.
  useEffect(
    () =>
      bus.on('tasks:onTimeSaved', (saved) =>
        setTasks((prev) => prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t))),
      ),
    [],
  );

  // Volta a ler sem esqueleto (depois de um import ou de uma escrita que
  // falhou a meio). Um pedido novo cancela o anterior; mudar de periodo ou
  // desmontar tambem.
  const refreshTasks = useCallback(async () => {
    // O periodo ja mudou: o carregamento do novo trata disso.
    if (periodRef.current !== periodParam) return;
    refreshRef.current?.abort();
    const controller = new AbortController();
    refreshRef.current = controller;
    try {
      const data = await getUserTasks(periodParam, controller.signal);
      if (!controller.signal.aborted) setTasks(data);
    } catch (error) {
      if (controller.signal.aborted || isRequestCanceled(error)) return;
      console.error('Failed to refresh tasks', error);
    }
  }, [periodParam]);

  const reload = useCallback(() => {
    setHasError(false);
    setAttempt((n) => n + 1);
  }, []);

  return {
    tasks,
    setTasks,
    isLoading: loaded === null && !hasError,
    isStale: loaded !== null && loaded.period !== periodParam,
    // Periodo a que as tasks no ecra pertencem.
    dataPeriod: loaded?.period,
    hasError,
    refreshTasks,
    reload,
  };
}
