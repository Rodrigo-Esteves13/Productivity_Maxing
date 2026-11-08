// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "Taken",
  'medReminderStatus.reminded': "Reminder sent at {time}",
  'medReminderStatus.due': "Due now, reminder pending",
  'medReminderStatus.upcoming': "Next reminder at {clock}",
  'medReminderStatus.missed': "Missed: no reminder was sent",
  'medReminderStatus.missedHint': "Check notifications in Profile",
};
