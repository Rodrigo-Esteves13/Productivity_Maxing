import { useEffect, useState } from 'react';

export type DashboardWidgetKey =
  | 'today'
  | 'programsOverview'
  | 'periodProgress'
  | 'overloadAlert'
  | 'missingGrade'
  | 'upcoming'
  | 'atRisk'
  | 'deadlineOverlap'
  | 'areaBreakdown'
  | 'studyActivity'
  | 'studyCapacity'
  | 'courseForecast'
  | 'gradeProjection'
  | 'focusEffect'
  | 'gradeCalculator'
  | 'creditSimulator'
  | 'creditsAccumulated'
  | 'examCountdown'
  | 'staleTasks'
  | 'timeByArea'
  | 'estimationAccuracy'
  | 'deadlineCompliance'
  | 'weekdayLoad'
  | 'targetVsReal'
  | 'productivityByType'
  | 'difficultyVsGrade'
  | 'failingRisk'
  | 'planScenario';

// Chaves i18n (traduzidas com t() em DashboardWidgetToggles).
export const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  today: 'widget.today',
  programsOverview: 'widget.programsOverview',
  periodProgress: 'widget.periodProgress',
  overloadAlert: 'widget.overloadAlert',
  missingGrade: 'widget.missingGrade',
  upcoming: 'widget.upcoming',
  atRisk: 'widget.atRisk',
  deadlineOverlap: 'widget.deadlineOverlap',
  areaBreakdown: 'widget.areaBreakdown',
  studyActivity: 'widget.studyActivity',
  studyCapacity: 'widget.studyCapacity',
  courseForecast: 'widget.courseForecast',
  gradeProjection: 'widget.gradeProjection',
  focusEffect: 'widget.focusEffect',
  gradeCalculator: 'widget.gradeCalculator',
  creditSimulator: 'widget.creditSimulator',
  creditsAccumulated: 'widget.creditsAccumulated',
  examCountdown: 'widget.examCountdown',
  staleTasks: 'widget.staleTasks',
  timeByArea: 'widget.timeByArea',
  estimationAccuracy: 'widget.estimationAccuracy',
  deadlineCompliance: 'widget.deadlineCompliance',
  weekdayLoad: 'widget.weekdayLoad',
  targetVsReal: 'widget.targetVsReal',
  productivityByType: 'widget.productivityByType',
  difficultyVsGrade: 'widget.difficultyVsGrade',
  failingRisk: 'widget.failingRisk',
  planScenario: 'widget.planScenario',
};

const STORAGE_KEY = 'dashboard-widget-prefs';

// GPA summary itself is always shown - it's the core of the dashboard,
// not really optional. Everything else, including the credit simulator,
// can be hidden.
const DEFAULT_VISIBLE: Record<DashboardWidgetKey, boolean> = {
  today: true,
  programsOverview: true,
  periodProgress: true,
  overloadAlert: true,
  missingGrade: true,
  upcoming: true,
  atRisk: true,
  deadlineOverlap: true,
  areaBreakdown: true,
  studyActivity: true,
  studyCapacity: true,
  courseForecast: true,
  gradeProjection: true,
  focusEffect: true,
  gradeCalculator: true,
  creditSimulator: true,
  creditsAccumulated: true,
  examCountdown: true,
  staleTasks: true,
  timeByArea: true,
  estimationAccuracy: true,
  deadlineCompliance: true,
  weekdayLoad: true,
  targetVsReal: true,
  productivityByType: true,
  difficultyVsGrade: true,
  failingRisk: true,
  planScenario: true,
};

function loadPrefs(): Record<DashboardWidgetKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    return { ...DEFAULT_VISIBLE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function useDashboardWidgetPrefs() {
  const [visibility, setVisibility] = useState<Record<DashboardWidgetKey, boolean>>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    } catch {
      // Best-effort only - a user with storage disabled/full just doesn't
      // get the preference remembered across reloads, nothing breaks.
    }
  }, [visibility]);

  const toggle = (key: DashboardWidgetKey) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return { visibility, toggle };
}
