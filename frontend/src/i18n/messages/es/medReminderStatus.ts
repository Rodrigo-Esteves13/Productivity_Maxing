// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "Tomada",
  'medReminderStatus.reminded': "Recordatorio enviado a las {time}",
  'medReminderStatus.due': "Toca ahora, recordatorio pendiente",
  'medReminderStatus.upcoming': "Próximo recordatorio a las {clock}",
  'medReminderStatus.missed': "Perdida: no se envió ningún recordatorio",
  'medReminderStatus.missedHint': "Revisa las notificaciones en Perfil",
};
