import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COOKIE_NOTICE_DISMISSED_KEY } from '../../lib/constants';

// Desktop already has the Register/Log in buttons sitting right under the
// hero, always in view on any reasonable viewport height. On mobile the
// hero + both buttons scroll away as soon as someone reads the feature
// cards or the FAQ below - this keeps a persistent, thumb-reachable way
// back to sign-up without needing to scroll back up. sm:hidden means it
// never shows on desktop, where it'd just be redundant.
//
// Gated on the cookie notice's dismissed state: CookieNotice.tsx is also
// `fixed bottom-0 inset-x-0` - showing both at once would have them
// overlap at the exact same screen position, with CookieNotice's higher
// z-index just covering this up entirely. Simplest correct fix: wait
// until the (one-time, one-tap) cookie notice is dismissed before this
// appears, rather than guessing at a pixel offset that only holds for one
// specific line-wrap of the cookie notice's text.
export default function StickyMobileCta() {
  const navigate = useNavigate();
  const [cookieNoticeDismissed, setCookieNoticeDismissed] = useState(true);

  useEffect(() => {
    setCookieNoticeDismissed(!!window.localStorage.getItem(COOKIE_NOTICE_DISMISSED_KEY));
  }, []);

  if (!cookieNoticeDismissed) return null;

  return (
    <div className="print-hide sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 py-3">
      <button
        type="button"
        onClick={() => navigate('/register')}
        className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
      >
        Get started for free
      </button>
    </div>
  );
}
