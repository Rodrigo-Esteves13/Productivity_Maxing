// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "Prise effectuée",
  'medReminderStatus.reminded': "Rappel envoyé à {time}",
  'medReminderStatus.due': "À prendre maintenant, rappel en attente",
  'medReminderStatus.upcoming': "Prochain rappel à {clock}",
  'medReminderStatus.missed': "Manquée : aucun rappel n'a été envoyé",
  'medReminderStatus.missedHint': "Vérifie les notifications dans Profil",
};
