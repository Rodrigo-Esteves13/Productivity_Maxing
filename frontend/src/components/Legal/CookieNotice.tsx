import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COOKIE_NOTICE_DISMISSED_KEY } from '../../lib/constants';

/**
 * Aviso informativo sobre cookies - NÃO é um bloqueio/consent-gate, porque
 * os únicos cookies que usamos (sessão HttpOnly + CSRF) são "estritamente
 * necessários" ao abrigo do GDPR (art. 5(3) da ePrivacy Directive), o que
 * está isento do requisito de consentimento prévio - só precisa de
 * informação clara, que é o que este componente dá.
 *
 * Não guarda nada de analítico nem liga a nenhum serviço de tracking - só
 * lembra, via localStorage, que o utilizador já viu e fechou o aviso.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(COOKIE_NOTICE_DISMISSED_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(COOKIE_NOTICE_DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 py-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <p className="text-sm text-neutral-300 flex-1">
          We use only strictly necessary cookies to keep you signed in and protect your account. No
          tracking or advertising cookies, ever. See our{' '}
          <Link to="/privacy" className="underline text-violet-400 hover:text-violet-300">
            Privacy Policy
          </Link>{' '}
          for details.
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
