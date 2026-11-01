import type { Task } from '../types/models';
import { tomorrowForTask } from './weekDates';

// Acoes rapidas da paleta (Ctrl+K) sobre a task destacada. Enter continua a
// abrir a task; estas sao as secundarias. Logica pura: a paleta so desenha.

export type PaletteTaskActionId = 'done' | 'postpone' | 'focus';

export interface PaletteTaskAction {
  id: PaletteTaskActionId;
  labelKey: string;
  // Atalho: Enter com estes modificadores ("mod" = Ctrl, ou Cmd no Mac).
  mod: boolean;
  shift: boolean;
}

const ACTIONS: Record<PaletteTaskActionId, PaletteTaskAction> = {
  done: { id: 'done', labelKey: 'paletteActions.done', mod: true, shift: false },
  postpone: { id: 'postpone', labelKey: 'paletteActions.postpone', mod: false, shift: true },
  focus: { id: 'focus', labelKey: 'paletteActions.focus', mod: true, shift: true },
};

const COMPLETED_STATUS = 'COMPLETED';

export interface PaletteActionContext {
  // Ja ha uma sessao de estudo a correr: so se pode ter uma de cada vez.
  hasActiveSession: boolean;
  now?: Date;
}

type ActionTask = Pick<Task, 'progressStatus' | 'date'>;

/** Adiar para amanha so faz sentido se a task ainda nao e de amanha ou depois. */
export function canPostponeToTomorrow(task: Pick<Task, 'date'>, now: Date = new Date()): boolean {
  const current = new Date(task.date);
  if (Number.isNaN(current.getTime())) return false;
  return tomorrowForTask(current, now).getTime() > current.getTime();
}

/** Acoes secundarias disponiveis para uma task, pela ordem em que se mostram. */
export function paletteTaskActions(task: ActionTask, context: PaletteActionContext): PaletteTaskAction[] {
  if (task.progressStatus === COMPLETED_STATUS) return [];
  const actions: PaletteTaskAction[] = [ACTIONS.done];
  if (canPostponeToTomorrow(task, context.now)) actions.push(ACTIONS.postpone);
  if (!context.hasActiveSession) actions.push(ACTIONS.focus);
  return actions;
}

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Que acao um Enter com modificadores pede (null = Enter normal: abrir a
 * task). Ctrl/Cmd+Enter = feita, Shift+Enter = amanha, Ctrl/Cmd+Shift+Enter =
 * focar.
 */
export function actionForKey(event: KeyLike): PaletteTaskActionId | null {
  if (event.key !== 'Enter' || event.altKey) return null;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.shiftKey) return 'focus';
  if (mod) return 'done';
  if (event.shiftKey) return 'postpone';
  return null;
}

/** Texto do atalho de uma acao, para os botoes e para a dica do rodape. */
export function shortcutLabel(action: Pick<PaletteTaskAction, 'mod' | 'shift'>, isMac: boolean): string {
  const parts: string[] = [];
  if (action.mod) parts.push(isMac ? 'Cmd' : 'Ctrl');
  if (action.shift) parts.push('Shift');
  parts.push('Enter');
  return parts.join('+');
}

/** A acao so corre se estiver na lista da task (ex: nao ha "feita" numa task concluida). */
export function resolveAction(
  task: ActionTask,
  id: PaletteTaskActionId | null,
  context: PaletteActionContext,
): PaletteTaskActionId | null {
  if (!id) return null;
  return paletteTaskActions(task, context).some((action) => action.id === id) ? id : null;
}
