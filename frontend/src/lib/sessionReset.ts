// Estado em memoria que pertence a quem tem sessao. O logout e SPA (sem
// recarregar), por isso cada modulo regista aqui como o esquecer; assim o
// AuthContext nao tem de importar (nem puxar para o bundle inicial) cada um.
const resets = new Set<() => void>();

export function onSessionReset(reset: () => void): void {
  resets.add(reset);
}

export function runSessionResets(): void {
  for (const reset of resets) reset();
}
