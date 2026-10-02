// Canal leve entre qualquer página e o modal global de confirmação do sync
// com o Google Calendar. Quem altera algo que o calendário devia refletir
// (turnos, locais, horário importado) só chama requestCalendarSyncReview();
// o modal decide se há algo a mostrar. Um evento de janela evita ligar
// contexto/props pela app inteira só para isto.

const EVENT_NAME = 'pmaxing:calendar-sync-review';

export interface CalendarSyncReviewRequest {
  // true = abrir mesmo sem alterações ("já está tudo sincronizado"), usado
  // pelo botão manual; false = só abrir se houver algo a mudar.
  force: boolean;
}

export function requestCalendarSyncReview(options: { force?: boolean } = {}): void {
  window.dispatchEvent(
    new CustomEvent<CalendarSyncReviewRequest>(EVENT_NAME, {
      detail: { force: options.force ?? false },
    }),
  );
}

export function subscribeToCalendarSyncReview(
  handler: (request: CalendarSyncReviewRequest) => void,
): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<CalendarSyncReviewRequest>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
