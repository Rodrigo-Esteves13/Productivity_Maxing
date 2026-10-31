export interface DashboardFiltersState {
  search: string;
  areaId: string;
  academicType: string;
  difficulty: string;
  progressStatus: string;
  dateStatus: string;
  // Esforco (enum Effort ou 'NONE') e prontidao (ready/locked/dateTbd).
  effort: string;
  readiness: string;
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFiltersState = {
  search: '',
  areaId: '',
  academicType: '',
  difficulty: '',
  progressStatus: '',
  dateStatus: '',
  effort: '',
  readiness: '',
};
