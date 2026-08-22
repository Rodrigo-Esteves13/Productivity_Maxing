import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Marks a route as CSRF-exempt outright, regardless of whether an
 * access_token cookie happens to be present on the request.
 *
 * CsrfGuard's default rule ("only enforce when a session cookie exists")
 * is the right call for almost everything - normal API routes ARE the
 * session doing something, so if there's a session cookie, CSRF applies.
 * The telemetry routes break that assumption: they're deliberately public
 * and stateless (a crash report or a web-vitals ping isn't "the session
 * doing something"), but a browser that happens to ALSO have a valid
 * access_token cookie from being logged in still gets the enforcement -
 * and web-vitals metrics fire at app startup, often before the in-memory
 * CSRF token (csrfStore.ts) has even been populated by AuthContext's own
 * /auth/csrf call yet. That race is what was producing the 403s.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
