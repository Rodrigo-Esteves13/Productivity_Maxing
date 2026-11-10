import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardWidgetKey } from './useDashboardWidgetPrefs';
import { isDefaultOrder, moveItem, normalizeOrder, resetOrder } from '../lib/widgetOrder';

const STORAGE_KEY = 'dashboard-widget-order';

// Cartoes que o DashboardCardGrid desenha, na ordem em que sempre foram
// desenhados (a ordem por omissao nao muda nada para quem ja usa a app).
// Os restantes widgets (GPA, simulador, calculadora...) tem lugar fixo.
export const GRID_WIDGET_DEFAULT_ORDER: readonly DashboardWidgetKey[] = [
  'today',
  'packUpdates',
  'weeklyChallenge',
  'statusSummary',
  'moneySnapshot',
  'studyCapacity',
  'upcoming',
  'failingRisk',
  'ratingsSummary',
  'atRisk',
  'deadlineOverlap',
  'areaBreakdown',
  'studyActivity',
  'examCountdown',
  'testGaps',
  'staleTasks',
  'timeByArea',
  'courseForecast',
  'gradeProjection',
  'planScenario',
  'focusEffect',
  'estimationAccuracy',
  'deadlineCompliance',
  'weekdayLoad',
  'procrastinationWeekday',
  'targetVsReal',
  'productivityByType',
  'difficultyVsGrade',
  'weightVsGrade',
  'areaConsistency',
  'xpLevel',
];

function loadOrder(): DashboardWidgetKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeOrder(raw ? JSON.parse(raw) : null, GRID_WIDGET_DEFAULT_ORDER);
  } catch {
    return resetOrder(GRID_WIDGET_DEFAULT_ORDER);
  }
}

export function useDashboardWidgetOrder() {
  const [order, setOrder] = useState<DashboardWidgetKey[]>(loadOrder);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Best-effort: sem storage a ordem so nao fica lembrada.
    }
  }, [order]);

  const moveUp = useCallback((key: DashboardWidgetKey) => {
    setOrder((prev) => moveItem(prev, key, -1));
  }, []);
  const moveDown = useCallback((key: DashboardWidgetKey) => {
    setOrder((prev) => moveItem(prev, key, 1));
  }, []);
  const reset = useCallback(() => {
    setOrder(resetOrder(GRID_WIDGET_DEFAULT_ORDER));
  }, []);
  const isDefault = useMemo(() => isDefaultOrder(order, GRID_WIDGET_DEFAULT_ORDER), [order]);

  return { order, moveUp, moveDown, reset, isDefault };
}
