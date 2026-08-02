# Architecture Decision Records

One file per significant, hard-to-reverse decision - the "why", not the
"what" (the code already shows what; git blame shows when; this is for
the reasoning that isn't visible in the diff). Write one when a decision
took real back-and-forth to reach, or when a future you (or anyone else)
would otherwise ask "wait, why is this built like this?"

Numbered sequentially, never renumbered or deleted - superseded decisions
get a new ADR that says so and links back, the old one stays as a record
of what was tried and why it changed.

## Template

```markdown
# NNNN. Title (short, describes the decision itself)

Date: YYYY-MM-DD
Status: proposed | accepted | superseded by ADR-NNNN

## Context
What problem forced this decision? What constraints applied?

## Decision
What was actually decided.

## Consequences
What this makes easier, what it makes harder, what was traded away.
```

## Index

- [0001](0001-record-architecture-decisions.md) - Record architecture decisions
- [0002](0002-httponly-cookies-over-localstorage-jwt.md) - httpOnly cookies over localStorage for auth tokens
- [0003](0003-enumoption-table-over-postgres-enums.md) - EnumOption table over native Postgres enums
- [0004](0004-native-fetch-over-googleapis-sdk.md) - Native fetch over the googleapis SDK for Calendar
- [0005](0005-structured-logging-no-telemetry-table.md) - Structured JSON logs instead of a telemetry DB table
