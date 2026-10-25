// Copia local do que nao chegou a ser gravado ao sair de uma entrada do
// caderno (rede em baixo, 5xx, conflito). Fica em sessionStorage (so este
// separador, apaga-se ao fechar) e a entrada oferece repor ao ser reaberta.
const KEY_PREFIX = 'pmaxing:notebook-unsaved:';

function keyFor(entryId: string): string {
  return `${KEY_PREFIX}${entryId}`;
}

export function saveUnsavedEntryDraft<T>(entryId: string, payload: T): boolean {
  try {
    sessionStorage.setItem(keyFor(entryId), JSON.stringify(payload));
    return true;
  } catch {
    // Sem storage (modo privado, quota): so resta o aviso.
    return false;
  }
}

export function readUnsavedEntryDraft<T>(entryId: string): T | null {
  try {
    const raw = sessionStorage.getItem(keyFor(entryId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearUnsavedEntryDraft(entryId: string): void {
  try {
    sessionStorage.removeItem(keyFor(entryId));
  } catch {
    // nada a limpar
  }
}
