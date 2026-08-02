# 0003. EnumOption table over native Postgres enums

Date: 2026-08-02 (decision itself made earlier; backfilled here)
Status: accepted

## Context

`Difficulty`, `ProgressStatus`, `TaskType`, and `AcademicTaskType` started
as native Postgres enums via Prisma (`enum Difficulty { EASY MEDIUM ... }`)
- the obvious first choice, and fine as long as the set of values never
needs to change without a migration. But task types in particular are
genuinely per-user/per-course customization (a new course brings new
kinds of graded work), and a native enum means adding one value requires
a schema migration, a deploy, and touches every environment - not
something that should gate a user just wanting to add "Lab Report" as a
task type.

## Decision

Converted those four (kept as native Postgres enums where the set really
is fixed: `Role`, `Provider`) into rows in a generic `EnumOption` table
(`category`, `key`, `label`, `colorHex`, `order`, `isActive`) instead.
`StatusBadge`/`DifficultyBadge` read `colorHex` via inline styles rather
than a hardcoded style map per enum value.

## Consequences

Adding, renaming, reordering, or deactivating an option is now an admin
UI action, not a migration - the whole reason for the change. The
tradeoff: TypeScript can no longer enforce these as a closed union at
compile time (`TaskType = string`, not a literal union), so validity has
to be checked at runtime instead (against the active `EnumOption` rows
for that category) - a category of bug (typo'd/stale key) that a native
enum would have caught at the type level now has to be caught by
validation instead. Worth it here because the whole point is that the
set of valid values is meant to change without a code change.
