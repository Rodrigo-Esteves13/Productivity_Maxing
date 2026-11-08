// Estado dos lembretes de medicacao de hoje.
export const medReminderStatus: Record<string, string> = {
  'medReminderStatus.taken': "복용 완료",
  'medReminderStatus.reminded': "{time}에 알림을 보냈습니다",
  'medReminderStatus.due': "복용 시간입니다. 알림 대기 중",
  'medReminderStatus.upcoming': "다음 알림: {clock}",
  'medReminderStatus.missed': "놓침: 알림이 전송되지 않았습니다",
  'medReminderStatus.missedHint': "프로필에서 알림 설정을 확인하세요",
};
