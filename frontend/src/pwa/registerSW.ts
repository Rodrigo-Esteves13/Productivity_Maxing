import { registerSW } from 'virtual:pwa-register';

/**
 * Regista o service worker gerado pelo vite-plugin-pwa.
 *
 * registerType: 'autoUpdate' no vite.config.ts + immediate: true aqui =
 * assim que há um build novo, o SW troca sozinho na próxima navegação,
 * sem prompt "há uma versão nova, queres atualizar?" - simplicidade em
 * troca de nunca ninguém ficar preso numa versão velha do frontend a
 * falar com uma API já migrada.
 */
export function initServiceWorker() {
  // Só faz sentido em produção (build); em dev o SW está desligado
  // (devOptions.enabled: false no vite.config.ts).
  if (import.meta.env.DEV) return;

  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Falha ao registar o service worker:', error);
    },
  });
}
