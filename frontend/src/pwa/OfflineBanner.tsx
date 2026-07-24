import { useOnlineStatus } from './useOnlineStatus';

/**
 * Aviso fixo no topo quando o browser está offline.
 *
 * Importante: a app não faz cache de dados de utilizador (tasks, etc. são
 * sempre NetworkOnly no service worker), por isso "offline" aqui significa
 * mesmo "sem acesso à API" - não há dados stale escondidos, só a UI
 * estática (shell) que continua a carregar do cache do SW. Este banner
 * existe para o user perceber porque é que as ações estão a falhar.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-violet-800 px-4 py-2 text-sm font-medium text-neutral-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={16}
        height={16}
        className="shrink-0"
      >
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      No internet connection. Some actions may not work until the
      connection returns.
    </div>
  );
}
