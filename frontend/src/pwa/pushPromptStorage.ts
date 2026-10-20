// O pedido de notificacoes a entrada aparece UMA vez por conta e por
// dispositivo (as subscricoes push sao por dispositivo). Depois de qualquer
// resposta (Ligar, Agora nao, fechar) nunca mais aparece sozinho: a escolha
// passa a viver no cartao Push notifications do Profile.
const KEY_PREFIX = 'pm-push-prompt-answered:';

export function wasPushPromptAnswered(userId: string): boolean {
  try {
    return window.localStorage.getItem(KEY_PREFIX + userId) === '1';
  } catch {
    // Sem localStorage (modo privado estrito): melhor nao perguntar a cada
    // pagina do que insistir sem conseguir lembrar a resposta.
    return true;
  }
}

export function markPushPromptAnswered(userId: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, '1');
  } catch {
    // Ignorado: ver wasPushPromptAnswered.
  }
}
