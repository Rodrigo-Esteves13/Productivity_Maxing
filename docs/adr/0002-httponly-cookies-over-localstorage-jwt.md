# 0002. httpOnly cookies over localStorage for auth tokens

Date: 2026-08-02 (decision itself made earlier; backfilled here)
Status: accepted

## Context

Auth originally stored the JWT in localStorage, read by the frontend and
sent as a Bearer header on every request - the simplest thing to build
first, and common enough as a starting point. But it means any XSS
anywhere in the app (a dependency, a rendering bug, anything) can read
`localStorage` directly and exfiltrate the token wholesale - no special
access needed, just `localStorage.getItem(...)`.

## Decision

Migrated to httpOnly cookies for the access token, with a CSRF
double-submit pattern for state-changing requests (`CsrfGuard`,
`cookie.config.ts`, `csrfStore.ts` on the frontend, `withCredentials:
true` on every request). `JwtStrategy` reads the token from the cookie,
with a Bearer-header fallback kept only for Swagger/Postman during
manual API testing.

## Consequences

An XSS bug can no longer read the token directly - `httpOnly` blocks all
JS access to the cookie, browser-enforced. In exchange, every
state-changing request needs a CSRF token pulled from `csrfStore` and
sent as a header (`CsrfGuard` enforces this on the backend), and cookies
bring their own considerations (`SameSite`, domain scoping between the
Netlify frontend and Render backend) that a header-based Bearer token
wouldn't have needed. OAuth callback redirects and the calendar-sync flow
also had to be re-checked against the cookie's `SameSite` setting, since
a top-level redirect from Google's OAuth consent screen back to the app
is a cross-site navigation.
