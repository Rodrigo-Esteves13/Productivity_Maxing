import { useContext } from 'react';
import { DashboardDataContext } from './dashboard-data-context';

export function useDashboardCardData() {
  const data = useContext(DashboardDataContext);
  if (!data) throw new Error('useDashboardCardData needs a DashboardDataContext provider.');
  return data;
}
