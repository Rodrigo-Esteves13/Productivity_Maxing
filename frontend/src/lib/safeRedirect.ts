// src/lib/safeRedirect.ts

// Guards the `?redirect=` query param on Login.tsx (used by
// SharedNotebookEntry.tsx to send an unauthenticated visitor to log in
// and land back on the share they were trying to open) against becoming
// an open redirect. A query param is attacker-controlled input the
// moment it decides where the browser navigates next - accepting
// anything here would let a phishing link read
// "yourapp.com/login?redirect=https://evil.example" and bounce a
// freshly-authenticated user straight off-site.
//
// Only a same-site, absolute path is accepted: must start with a single
// "/" (never "//" or "/\", both of which browsers can treat as
// protocol-relative and resolve to a different host) and must not
// contain "://" anywhere (rules out an embedded absolute URL smuggled
// into the path, e.g. "/redirect?next=https://evil.example").
export function isSafeRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('://')) return false;
  return true;
}
