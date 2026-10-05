// Avisos de fim de bloco/pausa: som curto e, se a pessoa deixou, notificacao
// do sistema (funciona com a tab em segundo plano).

export function requestNotifyPermission(): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  void Notification.requestPermission();
}

export function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Alguns browsers moveis so deixam notificar via service worker.
  }
}

// Dois toques curtos. O AudioContext so toca depois de um gesto da pessoa
// (ela clicou em "Start" para chegar aqui); se for bloqueado, falha em silencio.
export function playChime(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Sem audio: o aviso visual e a notificacao continuam.
  }
}
