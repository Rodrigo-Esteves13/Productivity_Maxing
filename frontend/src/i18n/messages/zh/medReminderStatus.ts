// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "已服用",
  'medReminderStatus.reminded': "提醒已于 {time} 发送",
  'medReminderStatus.due': "已到服药时间，提醒待发送",
  'medReminderStatus.upcoming': "下次提醒：{clock}",
  'medReminderStatus.missed': "已错过：未发送任何提醒",
  'medReminderStatus.missedHint': "请在个人资料中检查通知设置",
};
