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

// Som do aviso: dois toques de 880 Hz (A5), o segundo 0,25 s depois.
const CHIME_OFFSETS_S = [0, 0.25];
const CHIME_FREQUENCY_HZ = 880;
// Ganho minimo > 0 porque o exponentialRamp nao aceita zero.
const CHIME_SILENT_GAIN = 0.0001;
const CHIME_PEAK_GAIN = 0.2;
const CHIME_ATTACK_S = 0.02;
const CHIME_DECAY_S = 0.2;
const CHIME_STOP_S = 0.22;
// Fecha o AudioContext depois de o ultimo toque acabar.
const CHIME_CLOSE_DELAY_MS = 800;

// Dois toques curtos. O AudioContext so toca depois de um gesto da pessoa
// (ela clicou em "Start" para chegar aqui); se for bloqueado, falha em silencio.
export function playChime(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    CHIME_OFFSETS_S.forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = CHIME_FREQUENCY_HZ;
      gain.gain.setValueAtTime(CHIME_SILENT_GAIN, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(CHIME_PEAK_GAIN, ctx.currentTime + offset + CHIME_ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(CHIME_SILENT_GAIN, ctx.currentTime + offset + CHIME_DECAY_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + CHIME_STOP_S);
    });
    setTimeout(() => void ctx.close(), CHIME_CLOSE_DELAY_MS);
  } catch {
    // Sem audio: o aviso visual e a notificacao continuam.
  }
}
