// Ultimo aviso de cada turma que a pessoa ja viu (por browser). Quem nao tem
// push ligado nao sabia que havia avisos novos: a lista de turmas compara
// isto com latestAnnouncementAt e mostra "novo aviso".
const STORAGE_KEY = 'turma-announcements-seen';

type SeenMap = Record<string, string>;

function load(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {};
  } catch {
    return {};
  }
}

export function hasUnseenAnnouncement(turmaId: string, latestAt: string | null): boolean {
  if (!latestAt) return false;
  const seen = load()[turmaId];
  return !seen || new Date(latestAt).getTime() > new Date(seen).getTime();
}

export function markAnnouncementsSeen(turmaId: string, at: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [turmaId]: at }));
  } catch {
    // Best-effort only.
  }
}
