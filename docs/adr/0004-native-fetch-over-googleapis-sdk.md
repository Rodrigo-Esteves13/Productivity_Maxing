# 0004. Native fetch over the googleapis SDK for Calendar

Date: 2026-08-02 (decision itself made earlier; backfilled here)
Status: accepted

## Context

Google Calendar sync needs the OAuth scopes actually granted (to know
whether calendar write access was given, not just basic login) and needs
those scopes captured reliably - which ran into a Passport quirk (a
6-argument `validate()` signature bug) before landing on calling Google's
`tokeninfo` endpoint directly to read back the granted scopes. The
`googleapis` npm package would have handled the Calendar API calls
themselves, but it's a large dependency (auth client, every Google API's
types, request machinery) for what this integration actually needs: a
handful of REST calls (create/update/delete event) plus one
scope-introspection call.

## Decision

`CalendarModule` talks to the Google Calendar REST API directly via
native `fetch`, with tokens managed (stored encrypted, refreshed) by
`CalendarService` rather than the SDK's built-in OAuth2Client. Scope
capture goes through Google's `tokeninfo` endpoint explicitly rather than
trusting whatever Passport's strategy reports.

## Consequences

No `googleapis` dependency (smaller install, fewer transitive deps to
patch/audit, no SDK version to track against Google's API changes) and
full control over exactly what's sent/logged/encrypted at each step -
useful given tokens here are already handled carefully (AES-256-GCM at
rest, see `token-cipher.ts`). The tradeoff: each Calendar REST endpoint
used has to be integrated by hand (request shape, error codes, pagination
if it's ever needed) instead of getting a typed client method for free,
and any future Calendar feature needing an endpoint not yet wired up
means writing that fetch call rather than just calling an SDK method that
already exists.
