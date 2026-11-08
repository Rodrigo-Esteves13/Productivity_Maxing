// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "Tomada",
  'medReminderStatus.reminded': "Lembrete enviado às {time}",
  'medReminderStatus.due': "A horas, lembrete a caminho",
  'medReminderStatus.upcoming': "Próximo lembrete às {clock}",
  'medReminderStatus.missed': "Falhada: não foi enviado nenhum lembrete",
  'medReminderStatus.missedHint': "Vê as notificações no Perfil",
};
