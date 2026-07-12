// src/api/calendarService.ts
import api from './client';

export interface CalendarStatus {
  connected: boolean;
}

export interface CalendarSyncResult {
  googleCalendarEventId: string | null;
}

export const getCalendarStatus = async (): Promise<CalendarStatus> => {
  const response = await api.get<CalendarStatus>('/calendar/status');
  return response.data;
};

export const syncTaskToCalendar = async (
  taskId: string,
): Promise<CalendarSyncResult> => {
  const response = await api.post<CalendarSyncResult>(
    `/calendar/tasks/${taskId}/sync`,
  );
  return response.data;
};

export const unsyncTaskFromCalendar = async (
  taskId: string,
): Promise<CalendarSyncResult> => {
  const response = await api.delete<CalendarSyncResult>(
    `/calendar/tasks/${taskId}/sync`,
  );
  return response.data;
};

// Issue #38: revoga o acesso ao Calendar (o login com Google continua a
// funcionar - só o refresh token/scope do Calendar é removido).
export const disconnectGoogleCalendar = async (): Promise<void> => {
  await api.delete('/auth/google/calendar');
};
