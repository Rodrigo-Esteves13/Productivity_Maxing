// Quais tabs da app estao abertas, partilhado por localStorage. Serve para
// uma tab que fecha NAO parar a sessao de Focus que outra tab ainda tem
// aberta (antes, fechar uma tab duplicada parava a sessao da outra).

const STORAGE_KEY = 'pmaxing:live-tabs';
const BEAT_INTERVAL_MS = 5_000;
// Uma tab que nao deu sinal ha mais do que isto conta como fechada
// (crash, suspensao do portatil...).
export const TAB_TTL_MS = 15_000;

export type TabRegistry = Record<string, number>;

/** True se alguma OUTRA tab deu sinal dentro do TTL. Funcao pura. */
export function hasOtherLiveTab(
  registry: TabRegistry,
  selfId: string,
  now: number,
  ttlMs: number = TAB_TTL_MS,
): boolean {
  return Object.entries(registry).some(
    ([tabId, lastSeen]) => tabId !== selfId && now - lastSeen <= ttlMs,
  );
}

function readRegistry(): TabRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TabRegistry) : {};
  } catch {
    return {};
  }
}

function writeRegistry(registry: TabRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // Sem localStorage (modo privado, quota): a app funciona na mesma,
    // so perde a deteccao de outras tabs.
  }
}

const selfId = crypto.randomUUID();

function beat(): void {
  const now = Date.now();
  const registry = readRegistry();
  // Limpa tabs mortas para o registo nao crescer sem fim.
  const alive = Object.fromEntries(
    Object.entries(registry).filter(([, lastSeen]) => now - lastSeen <= TAB_TTL_MS),
  );
  alive[selfId] = now;
  writeRegistry(alive);
}

/** Regista esta tab e mantem-na "viva". Devolve a funcao que a retira (usar em pagehide). */
export function registerTab(): () => void {
  beat();
  const interval = setInterval(beat, BEAT_INTERVAL_MS);
  return () => {
    clearInterval(interval);
    const { [selfId]: _self, ...others } = readRegistry();
    void _self;
    writeRegistry(others);
  };
}

/** Ha outra tab da app aberta neste momento? */
export function isAnotherTabOpen(): boolean {
  return hasOtherLiveTab(readRegistry(), selfId, Date.now());
}
