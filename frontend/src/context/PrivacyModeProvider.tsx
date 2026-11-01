import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PrivacyModeContext } from './privacy-mode-context';
import {
  PRIVACY_ACTIVITY_EVENTS,
  PRIVACY_IDLE_MS,
  readPrivacyPref,
  relockPrivacyPref,
  togglePrivacyPref,
  writePrivacyPref,
  type PrivacyPref,
} from '../lib/privacy';

// Estado do modo privacidade (localStorage). Depois de a pessoa o ligar uma
// vez, volta a ligar sozinho quando a tab fica escondida e apos inatividade.
export default function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<PrivacyPref>(readPrivacyPref);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((next: (current: PrivacyPref) => PrivacyPref) => {
    setPref((current) => {
      const value = next(current);
      if (value !== current) writePrivacyPref(value);
      return value;
    });
  }, []);

  const toggle = useCallback(() => update(togglePrivacyPref), [update]);

  useEffect(() => {
    const relock = () => update(relockPrivacyPref);
    const restartIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(relock, PRIVACY_IDLE_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') relock();
    };
    restartIdle();
    document.addEventListener('visibilitychange', onVisibility);
    PRIVACY_ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restartIdle, { passive: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
      PRIVACY_ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restartIdle));
    };
  }, [update]);

  const value = useMemo(() => ({ enabled: pref.enabled, toggle }), [pref.enabled, toggle]);
  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}
