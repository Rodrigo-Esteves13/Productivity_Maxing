// Ultima atividade da pessoa na app, partilhada entre tabs por localStorage:
// atividade numa tab conta para todas (quem estuda numa tab e le noutra nao
// esta inativo).

const ACTIVITY_KEY = 'pmaxing:last-activity';
// Sem atividade ha mais do que isto, pergunta "ainda estas a estudar?".
export const IDLE_PROMPT_MS = 20 * 60 * 1000;
const WRITE_THROTTLE_MS = 5_000;

/** Esta inativo se passou mais do que o limite desde a ultima atividade. Pura. */
export function isIdle(lastActivityMs: number, nowMs: number, thresholdMs: number = IDLE_PROMPT_MS): boolean {
  return nowMs - lastActivityMs > thresholdMs;
}

export function readLastActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastActivity(ms: number): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(ms));
  } catch {
    // Sem localStorage: sem deteccao de inatividade entre tabs.
  }
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Passa a registar a atividade desta tab. Devolve a funcao que para. */
export function startActivityTracking(): () => void {
  let lastWrite = 0;
  const mark = () => {
    const now = Date.now();
    if (now - lastWrite < WRITE_THROTTLE_MS) return;
    lastWrite = now;
    writeLastActivity(now);
  };
  mark();
  for (const name of ACTIVITY_EVENTS) window.addEventListener(name, mark, { passive: true });
  window.addEventListener('focus', mark);
  return () => {
    for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark);
    window.removeEventListener('focus', mark);
  };
}

/** Repoe a atividade para "agora" (ex: "sim, ainda estou aqui"). */
export function touchActivity(): void {
  writeLastActivity(Date.now());
}
