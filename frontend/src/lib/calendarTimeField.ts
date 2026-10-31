// Condicao unica: os campos de hora/duracao do formulario de task so aparecem
// com o Google Calendar ligado e "Add to Google Calendar" marcado. Partilhada
// por OptionalInfoFields e pela sugestao de hora da aula, para nao divergirem.
export function isCalendarTimeFieldVisible(calendarConnected: boolean, syncToCalendar: boolean): boolean {
  return calendarConnected && syncToCalendar;
}
