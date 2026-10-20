// Avisa a navbar que algo pendente no Social mudou (aceitou/recusou um
// pedido ou convite), para o contador atualizar logo em vez de esperar
// pelo proximo polling.
const SOCIAL_CHANGED_EVENT = 'pmaxing:social-changed';

export function notifySocialChanged(): void {
  window.dispatchEvent(new Event(SOCIAL_CHANGED_EVENT));
}

export function onSocialChanged(listener: () => void): () => void {
  window.addEventListener(SOCIAL_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SOCIAL_CHANGED_EVENT, listener);
}
