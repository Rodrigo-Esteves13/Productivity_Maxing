import { useEffect, useState } from 'react';

/**
 * Deteta se o browser está online/offline via navigator.onLine + eventos
 * 'online'/'offline'. Usado pelo OfflineBanner para nunca deixar o user
 * confundir dados cacheados (stale) com dados atuais da API.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
