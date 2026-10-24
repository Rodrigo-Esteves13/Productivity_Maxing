// src/api/calendarFeedService.ts
import api from './client';
import type { CalendarFeedStatus } from '../types/models';
import { API_BASE_URL } from './apiBaseUrl';

export const getCalendarFeed = async (): Promise<CalendarFeedStatus> => {
  const response = await api.get<CalendarFeedStatus>('/calendar/feed');
  return response.data;
};

// Liga o feed, ou RODA o segredo (o link antigo deixa de funcionar).
export const enableCalendarFeed = async (): Promise<CalendarFeedStatus> => {
  const response = await api.post<CalendarFeedStatus>('/calendar/feed');
  return response.data;
};

export const disableCalendarFeed = async (): Promise<CalendarFeedStatus> => {
  const response = await api.delete<CalendarFeedStatus>('/calendar/feed');
  return response.data;
};

// tasksOnly: so os prazos das tasks (?only=tasks), sem aulas/turnos/estudo.
export const feedUrl = (token: string, tasksOnly = false): string =>
  `${API_BASE_URL}/feed/${token}.ics${tasksOnly ? '?only=tasks' : ''}`;
// webcal:// abre direto a app de calendario (Apple/Outlook).
export const feedWebcalUrl = (token: string, tasksOnly = false): string =>
  feedUrl(token, tasksOnly).replace(/^https?:/, 'webcal:');
