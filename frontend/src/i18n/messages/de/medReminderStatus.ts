// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "Eingenommen",
  'medReminderStatus.reminded': "Erinnerung um {time} gesendet",
  'medReminderStatus.due': "Jetzt fällig, Erinnerung ausstehend",
  'medReminderStatus.upcoming': "Nächste Erinnerung um {clock}",
  'medReminderStatus.missed': "Verpasst: Es wurde keine Erinnerung gesendet",
  'medReminderStatus.missedHint': "Prüfe die Benachrichtigungen im Profil",
};
