import { useEffect, useState } from 'react';

export type DashboardWidgetKey =
  | 'programsOverview'
  | 'periodProgress'
  | 'upcoming'
  | 'atRisk'
  | 'areaBreakdown'
  | 'studyActivity'
  | 'gradeCalculator'
  | 'creditSimulator';

export const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  programsOverview: 'All programs overview',
  periodProgress: 'Period pace',
  upcoming: 'Next 7 days',
  atRisk: 'At risk',
  areaBreakdown: 'Breakdown by course',
  studyActivity: 'Study activity',
  gradeCalculator: 'Grade needed calculator',
  creditSimulator: '"What if" GPA simulator',
};

const STORAGE_KEY = 'dashboard-widget-prefs';

// GPA summary itself is always shown - it's the core of the dashboard,
// not really optional. Everything else, including the credit simulator,
// can be hidden.
const DEFAULT_VISIBLE: Record<DashboardWidgetKey, boolean> = {
  programsOverview: true,
  periodProgress: true,
  upcoming: true,
  atRisk: true,
  areaBreakdown: true,
  studyActivity: true,
  gradeCalculator: true,
  creditSimulator: true,
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
