# Load tests (k6)

## Setup

Install k6: https://k6.io/docs/get-started/installation/

Seed a test account on a **staging** environment - never a real user's
account, and think hard before pointing this at production at all (it
generates real load).

## Running

```bash
k6 run -e BASE_URL=https://your-staging-backend.onrender.com \
       -e TEST_EMAIL=loadtest@example.com \
       -e TEST_PASSWORD=whatever-you-seeded \
       backend/load-tests/exam-season.js
```

## What it simulates

A ramp from 10 to 50 concurrent "users", each logging in once and then
repeatedly hitting the same three reads the Dashboard fans out into on
load (`/tasks`, `/areas`, `/programs`), with a 2-5s pause between rounds -
the "everyone checks their deadlines around the same time" pattern that
actually happens before a deadline or during exam week, not a flat
steady trickle.

## When to run this

Before exam season, or before any change to the hot read path (the three
endpoints above, or anything they depend on - e.g. a Prisma query change
in TasksService.findAll). Not part of CI - this is a manual, deliberate
check against a staging environment with realistic data volume, not
something to run against a fresh empty CI database on every PR.

## Reading the results

k6 prints `http_req_duration` percentiles and the failure rate at the
end. The thresholds in `exam-season.js` (p95 < 800ms, < 1% failures) are
starting points, not measured baselines - tune them after a first real
run establishes what "normal" looks like on the actual Render instance
size in use.
