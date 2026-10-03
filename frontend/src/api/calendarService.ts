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

// ---- Sync do horário completo (aulas, turnos, viagens, blocos de estudo) ----

export type SyncAction = 'create' | 'update' | 'remove';

export interface SchedulePreviewItem {
  action: SyncAction;
  title: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SchedulePreview {
  create: number;
  update: number;
  remove: number;
  unchanged: number;
  withinLimit: boolean;
  days: number;
  items: SchedulePreviewItem[];
  hiddenCount: number;
}

export interface ScheduleSyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  failed: number;
}

export interface RemoveAllResult {
  deleted: number;
  failed: number;
  remaining: number;
}

// A janela (14 dias) é decidida pelo servidor: o utilizador não a escolhe.
export const previewScheduleSync = async (): Promise<SchedulePreview> => {
  const response = await api.get<SchedulePreview>('/calendar/schedule/preview');
  return response.data;
};

export const syncSchedule = async (): Promise<ScheduleSyncResult> => {
  const response = await api.post<ScheduleSyncResult>('/calendar/schedule/sync', {});
  return response.data;
};

export const removeSyncedSchedule = async (): Promise<RemoveAllResult> => {
  const response = await api.delete<RemoveAllResult>('/calendar/schedule');
  return response.data;
};
