// Chave de localStorage do overdue check-in: guarda o dia em que a fila
// deste utilizador ficou respondida (ou foi adiada com "Perguntar mais
// tarde"). Por utilizador: outra conta no mesmo browser no mesmo dia tem a
// sua propria fila.
export const OVERDUE_CHECK_KEY_PREFIX = 'pmaxing:lastOverdueCheckDate';
// Chave antiga (global, gravada antes de responder). So para limpar.
export const LEGACY_OVERDUE_CHECK_KEY = OVERDUE_CHECK_KEY_PREFIX;

export function overdueCheckKey(userId: string): string {
  return `${OVERDUE_CHECK_KEY_PREFIX}:${userId}`;
}

// localStorage pode lancar (modo privado, storage bloqueado): best-effort.
export function readOverdueCheckDay(userId: string): string | null {
  try {
    return localStorage.getItem(overdueCheckKey(userId));
  } catch {
    return null;
  }
}

export function writeOverdueCheckDay(userId: string, dayKey: string): void {
  try {
    localStorage.setItem(overdueCheckKey(userId), dayKey);
    localStorage.removeItem(LEGACY_OVERDUE_CHECK_KEY);
  } catch {
    // Sem storage: volta a pedir na proxima pagina, o backend filtra.
  }
}
