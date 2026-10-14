import type { AgendaItem } from './agenda';

// Cor de cada tipo de bloco na agenda: escola (azul), trabalho (amarelo) e
// eventos pontuais (rosa). Um evento pontual e um turno sem local e nao
// recorrente (medico, entrevista...) - antes partilhava o amarelo do
// trabalho e confundia-se com ele. As mesmas cores vao para o Google
// Calendar (COLOR_ID_BY_KIND no backend).
export type AgendaTone = 'class' | 'work' | 'event';

export function getAgendaTone(item: AgendaItem): AgendaTone {
  if (item.kind === 'class') return 'class';
  const { commitmentId, isRecurring } = item.occurrence;
  return commitmentId === null && !isRecurring ? 'event' : 'work';
}

export const AGENDA_TONE_CLASSES: Record<AgendaTone, { card: string; title: string; meta: string; dot: string }> = {
  class: {
    card: 'bg-blue-950/30 border border-blue-900/40',
    title: 'text-blue-200',
    meta: 'text-blue-200/60',
    dot: 'bg-blue-400',
  },
  work: {
    card: 'bg-amber-950/30 border border-amber-900/40',
    title: 'text-amber-200',
    meta: 'text-amber-200/60',
    dot: 'bg-amber-400',
  },
  event: {
    card: 'bg-pink-950/30 border border-pink-900/40',
    title: 'text-pink-200',
    meta: 'text-pink-200/60',
    dot: 'bg-pink-400',
  },
};

export const AGENDA_TONE_LABEL_KEY: Record<AgendaTone, string> = {
  class: 'schedule.legend.class',
  work: 'schedule.legend.work',
  event: 'schedule.legend.event',
};
