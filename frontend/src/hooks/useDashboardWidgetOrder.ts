import { useCallback, useMemo } from 'react';
import type { DashboardWidgetKey } from './useDashboardWidgetPrefs';
import { isDefaultOrder, moveItem, normalizeOrder, resetOrder } from '../lib/widgetOrder';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

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
  'typeBalance',
  'ectsWorkload',
];

const CODEC: PersistedCodec<DashboardWidgetKey[]> = {
  parse: (raw) => {
    try {
      return normalizeOrder(raw ? JSON.parse(raw) : null, GRID_WIDGET_DEFAULT_ORDER);
    } catch {
      return resetOrder(GRID_WIDGET_DEFAULT_ORDER);
    }
  },
  serialize: (order) => JSON.stringify(order),
};

export function useDashboardWidgetOrder() {
  const [order, setOrder] = usePersistedState(STORAGE_KEY, CODEC);

  const moveUp = useCallback((key: DashboardWidgetKey) => {
    setOrder((prev) => moveItem(prev, key, -1));
  }, [setOrder]);
  const moveDown = useCallback((key: DashboardWidgetKey) => {
    setOrder((prev) => moveItem(prev, key, 1));
  }, [setOrder]);
  const reset = useCallback(() => {
    setOrder(resetOrder(GRID_WIDGET_DEFAULT_ORDER));
  }, [setOrder]);
  const isDefault = useMemo(() => isDefaultOrder(order, GRID_WIDGET_DEFAULT_ORDER), [order]);

  return { order, moveUp, moveDown, reset, isDefault };
}
