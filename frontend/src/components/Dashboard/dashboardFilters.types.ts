export interface DashboardFiltersState {
  search: string;
  areaId: string;
  type: string;
  difficulty: string;
  progressStatus: string;
  dateStatus: string;
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFiltersState = {
  search: '',
  areaId: '',
  type: '',
  difficulty: '',
  progressStatus: '',
  dateStatus: '',
};
