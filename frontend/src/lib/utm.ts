const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const STORAGE_KEY = 'pm_utm_params';

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/**
 * Reads utm_* query params off the current URL (if present) and stashes
 * them in sessionStorage for the rest of this browser session - so a
 * campaign link landing on "/" or straight on "/register" isn't lost by
 * the time someone actually finishes signing up a few clicks later.
 *
 * Deliberately NOT sent anywhere by itself - this only writes to
 * sessionStorage (first-party, cleared when the tab closes, never leaves
 * the browser). It does not contradict the "no tracking/profiling" line
 * in PrivacyPolicy.tsx the way a third-party analytics SDK would; it's
 * just remembering a URL parameter for the current visit, the same way a
 * `?ref=` code on a coupon works. If you want it visible somewhere (e.g.
 * attached to a new account so you can tell which campaign it came from),
 * that needs one more small step: sending it along with the register
 * request and a column on User to store it - deliberately NOT done here,
 * that's a schema change and should be its own confirmed step, not
 * something that rides along with a "capture the URL" utility.
 *
 * Call once, near the app root (see App.tsx) - safe to call on every
 * mount, it's a no-op when the URL has no utm_* params and won't
 * overwrite an already-stored value with an empty one.
 */
export function captureUtmParams(): void {
  const params = new URLSearchParams(window.location.search);
  const found: UtmParams = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }

  if (Object.keys(found).length === 0) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // Private browsing / storage disabled - fine to silently skip, this
    // was never load-bearing for anything the app needs to function.
  }
}

/** Reads back whatever captureUtmParams() stored earlier this session, if anything. */
export function getStoredUtmParams(): UtmParams | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmParams) : null;
  } catch {
    return null;
  }
}
