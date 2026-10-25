import { HTTP_CONFLICT, getApiCode, getHttpStatus } from './httpError';
import type { NotebookEntry } from '../types/models';

// Mesmo codigo que NOTEBOOK_ENTRY_CONFLICT_CODE no backend (notebook.service.ts).
export const NOTEBOOK_ENTRY_CONFLICT_CODE = 'NOTEBOOK_ENTRY_CONFLICT';

/**
 * Gravar sobre uma versao antiga: alguem (co-owner, outro separador) gravou
 * a entrada depois de ela ser aberta aqui. Leva a versao atual do servidor
 * para o utilizador escolher entre a dele e a outra.
 */
export class EntryConflictError extends Error {
  readonly current: NotebookEntry;

  constructor(current: NotebookEntry) {
    super('Notebook entry conflict');
    this.current = current;
    this.name = 'EntryConflictError';
  }
}

/** A versao atual que o backend pos no corpo do 409, ou null se nao for esse 409. */
export function parseEntryConflict<T = NotebookEntry>(error: unknown): T | null {
  if (getHttpStatus(error) !== HTTP_CONFLICT || getApiCode(error) !== NOTEBOOK_ENTRY_CONFLICT_CODE) return null;
  const current = (error as { response?: { data?: { current?: unknown } } }).response?.data?.current;
  return current && typeof current === 'object' ? (current as T) : null;
}
