export interface DashboardFiltersState {
  search: string;
  areaId: string;
  academicType: string;
  difficulty: string;
  progressStatus: string;
  dateStatus: string;
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFiltersState = {
  search: '',
  areaId: '',
  academicType: '',
  difficulty: '',
  progressStatus: '',
  dateStatus: '',
};
