import { notebookEntryPath, turmaNotePath } from './appLinks';

export type RecentKind = 'nav' | 'task' | 'notebook' | 'turmaNote';

// So guarda o que identifica o item: o caminho reconstroi-se de kind + id (o
// que ficou guardado numa versao antiga nao e usado). parentId = id da turma
// nas notas de turma.
export interface RecentEntry {
  kind: RecentKind;
  id: string;
  label?: string;
  parentId?: string;
}

// Chave global antiga (partilhada por todas as contas): apagada ao carregar.
export const LEGACY_RECENTS_STORAGE_KEY = 'palette-recents';
export const RECENTS_STORAGE_KEY_PREFIX = 'palette-recents:';
export const MAX_RECENTS = 5;

const KINDS: RecentKind[] = ['nav', 'task', 'notebook', 'turmaNote'];

// Os recentes sao de uma conta: sem userId nao se le nem se escreve nada.
export const recentsStorageKey = (userId: string): string => `${RECENTS_STORAGE_KEY_PREFIX}${userId}`;

function isRecentEntry(value: unknown): value is RecentEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.kind === 'string' &&
    (KINDS as string[]).includes(v.kind) &&
    typeof v.id === 'string' &&
    v.id !== '' &&
    (v.label === undefined || typeof v.label === 'string') &&
    (v.parentId === undefined || typeof v.parentId === 'string')
  );
}

// Novo item vai para a frente; repetido (kind+id) nao duplica; maximo MAX_RECENTS.
export function addRecent(list: RecentEntry[], entry: RecentEntry, max: number = MAX_RECENTS): RecentEntry[] {
  const rest = list.filter((e) => !(e.kind === entry.kind && e.id === entry.id));
  return [entry, ...rest].slice(0, max);
}

export function removeRecentFrom(list: RecentEntry[], kind: RecentKind, id: string): RecentEntry[] {
  return list.filter((e) => !(e.kind === kind && e.id === id));
}

// Caminho do item, sempre reconstruido (nunca vem do armazenamento). null =
// nao se consegue reconstruir (nav: resolve-se pela lista de comandos; nota de
// turma sem turma).
export function recentPath(entry: RecentEntry): string | null {
  if (entry.kind === 'task') return `/tasks?open=${encodeURIComponent(entry.id)}`;
  if (entry.kind === 'notebook') return notebookEntryPath(entry.id);
  if (entry.kind === 'turmaNote') return entry.parentId ? turmaNotePath(entry.parentId, entry.id) : null;
  return null;
}

export function parseRecents(raw: string | null, max: number = MAX_RECENTS): RecentEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const out: RecentEntry[] = [];
    for (const item of data) {
      if (!isRecentEntry(item)) continue;
      const key = `${item.kind}-${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: item.kind,
        id: item.id,
        ...(item.label !== undefined ? { label: item.label } : {}),
        ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
      });
    }
    return out.slice(0, max);
  } catch {
    return [];
  }
}

function dropLegacyKey(): void {
  try {
    localStorage.removeItem(LEGACY_RECENTS_STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}

function save(userId: string, list: RecentEntry[]): void {
  try {
    localStorage.setItem(recentsStorageKey(userId), JSON.stringify(list));
  } catch {
    // Best-effort only.
  }
}

export function loadRecents(userId: string | null | undefined): RecentEntry[] {
  dropLegacyKey();
  if (!userId) return [];
  try {
    return parseRecents(localStorage.getItem(recentsStorageKey(userId)));
  } catch {
    return [];
  }
}

export function recordRecent(userId: string | null | undefined, entry: RecentEntry): void {
  if (!userId) return;
  save(userId, addRecent(loadRecents(userId), entry));
}

export function removeRecent(userId: string | null | undefined, kind: RecentKind, id: string): void {
  if (!userId) return;
  save(userId, removeRecentFrom(loadRecents(userId), kind, id));
}

export function clearRecents(userId: string | null | undefined): void {
  dropLegacyKey();
  if (!userId) return;
  try {
    localStorage.removeItem(recentsStorageKey(userId));
  } catch {
    // Best-effort only.
  }
}

// O item ja nao existe (apagado) ou ja nao se tem acesso a ele.
export function isGoneError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === 404 || status === 403;
}
