// Junta data + horas dos campos do formulario numa janela [inicio, fim] em
// ISO, com as mesmas regras que o servidor aplica (validateSessionWindow no
// backend): fim depois do inicio, nao no futuro, no maximo 16 horas. Dar o
// erro aqui poupa um pedido e uma mensagem menos clara.

export const MAX_SESSION_HOURS = 16;

export type SessionWindowResult =
  | { ok: true; startedAt: string; endedAt: string }
  | { ok: false; error: string };

// `new Date('YYYY-MM-DDTHH:mm')` le a data na hora LOCAL de quem escreve.
function parseLocal(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildSessionWindow(date: string, startTime: string, endTime: string, now: Date): SessionWindowResult {
  const start = parseLocal(date, startTime);
  const end = parseLocal(date, endTime);
  if (!start || !end) return { ok: false, error: 'Fill in the date and both times.' };
  if (end.getTime() <= start.getTime()) return { ok: false, error: 'The end must be after the start.' };
  if (end.getTime() > now.getTime()) return { ok: false, error: 'A session cannot end in the future.' };
  if ((end.getTime() - start.getTime()) / 3_600_000 > MAX_SESSION_HOURS) {
    return { ok: false, error: `A session cannot be longer than ${MAX_SESSION_HOURS} hours.` };
  }
  return { ok: true, startedAt: start.toISOString(), endedAt: end.toISOString() };
}

/** Partes locais (data e hora) de um instante ISO, no formato dos <input type=date/time>. */
export function toLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
