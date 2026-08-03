# 0001. Record architecture decisions

Date: 2026-08-02
Status: accepted

## Context

This is a solo project, but "solo" doesn't mean the reasoning behind a
non-obvious choice is any less likely to be forgotten a few months later.
Several decisions already made in this codebase (cookies over
localStorage, a runtime-editable enum table over native Postgres enums,
native `fetch` over the Google API SDK) took real back-and-forth to
reach, and none of that reasoning lives anywhere but scattered code
comments and chat history.

## Decision

Keep lightweight ADRs under `docs/adr/`, one file per decision, using the
template in `docs/adr/README.md`. Only for decisions that were actually
hard to reach or that a future reader would otherwise have to
reverse-engineer from the diff - not a changelog, not one per PR.

## Consequences

A small amount of upfront writing for each decision worth recording.
In exchange, "why is this built like this" has an actual answer instead
of needing to be re-derived (or re-litigated) from scratch later.
