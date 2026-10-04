// Avisa as outras tabs de que a sessao de Focus mudou (comecou, parou),
// para todas mostrarem o mesmo estado sem esperar pelo proximo pedido.

const CHANNEL_NAME = 'pmaxing-focus';

function open(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

/** Diz as outras tabs "a sessao mudou". Nao chega a esta propria tab. */
export function announceSessionChanged(): void {
  const channel = open();
  if (!channel) return;
  channel.postMessage('changed');
  channel.close();
}

/** Corre `onChange` quando OUTRA tab anuncia uma mudanca. Devolve a funcao que desliga. */
export function onSessionChangedElsewhere(onChange: () => void): () => void {
  const channel = open();
  if (!channel) return () => {};
  channel.onmessage = onChange;
  return () => channel.close();
}
