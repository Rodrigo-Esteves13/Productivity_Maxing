# 0005. Structured JSON logs instead of a telemetry DB table

Date: 2026-08-02
Status: accepted

## Context

Adding crash reporting (`ErrorBoundary`) and Core Web Vitals meant
deciding where reported data goes. The obvious default is a new Prisma
model (`ClientError`, `WebVitalMetric`) with its own migration, indexes,
and eventually a retention/cleanup story. That's real ongoing surface for
data that's inherently high-volume, low-value-per-row, and time-series in
nature - closer to logs than to the app's actual domain data (Tasks,
Areas, Programs).

## Decision

`TelemetryService` logs both client errors and web vitals as structured
JSON lines via the same `JsonLogger` now used app-wide (see
`common/logger/json-logger.service.ts`), rather than writing to a new
database table. Render already aggregates every instance's
stdout/stderr, and NDJSON lines are directly queryable there.

## Consequences

No new migration, no new table to index/prune/back up, and the telemetry
endpoints (`POST /telemetry/client-error`, `POST /telemetry/web-vitals`)
stay simple (validate, log, 204 - no DB round-trip on a public,
unauthenticated route). The tradeoff: no SQL querying, no dashboard, no
"show me CLS trend over the last 30 days" without shipping these logs
somewhere queryable first (a log platform, or a scheduled job that parses
Render's log export into a table). Revisit this once there's an actual
need to slice/aggregate the data rather than just spot-check it - the
logging call sites in `TelemetryService` don't need to change either way,
only where the aggregation happens.
