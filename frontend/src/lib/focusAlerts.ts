// Avisos de fim de bloco/pausa: som curto e, se a pessoa deixou, notificacao
// do sistema (funciona com a tab em segundo plano).

export type NotifyPermission = NotificationPermission | 'unsupported';

export function notifyPermission(): NotifyPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() !== 'default') return notifyPermission();
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

// Mesma tag para os avisos do Focus: o novo substitui o anterior em vez de
// empilhar. O clique abre /focus (ver notificationclick em public/push-sw.js).
const FOCUS_NOTIFICATION_TAG = 'pmaxing-focus';
const FOCUS_PATH = '/focus';

// `renotify` ainda nao esta no lib.dom do TypeScript, mas os browsers aceitam.
type AlertOptions = NotificationOptions & { renotify?: boolean };

function notifyViaConstructor(title: string, body: string): void {
  try {
    const options: AlertOptions = { body, tag: FOCUS_NOTIFICATION_TAG, renotify: true };
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Sem forma de notificar: ficam o som e o cartao no ecra.
  }
}

// Primeiro pelo service worker: em Android e na app instalada, `new
// Notification` lanca erro e o aviso perdia-se em silencio.
export function notify(title: string, body: string): void {
  if (notifyPermission() !== 'granted') return;
  // renotify: o aviso do fim da pausa substitui o do fim do bloco (mesma
  // tag, requireInteraction mantem-no na bandeja); sem isto vinha sem som.
  const options: AlertOptions = {
    body,
    tag: FOCUS_NOTIFICATION_TAG,
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    requireInteraction: true,
    data: { url: FOCUS_PATH },
  };
  if (!('serviceWorker' in navigator)) {
    notifyViaConstructor(title, body);
    return;
  }
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => {
      if (!registration?.active) throw new Error('no-service-worker');
      return registration.showNotification(title, options);
    })
    .catch(() => notifyViaConstructor(title, body));
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
