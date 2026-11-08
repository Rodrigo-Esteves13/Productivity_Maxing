// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "服用済み",
  'medReminderStatus.reminded': "{time} にリマインダーを送信しました",
  'medReminderStatus.due': "服用時刻です。リマインダー送信待ち",
  'medReminderStatus.upcoming': "次のリマインダー: {clock}",
  'medReminderStatus.missed': "見逃し: リマインダーは送信されませんでした",
  'medReminderStatus.missedHint': "プロフィールで通知設定を確認してください",
};
