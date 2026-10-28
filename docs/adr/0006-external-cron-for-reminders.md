# 0006. External cron service for reminders, GitHub Actions as a fallback

Date: 2026-10-27
Status: accepted

## Context

Deadline and medication reminders run when something calls
`POST /internal/reminders/run` with the `x-cron-secret` header (see
`backend/src/reminders`). Until now only the GitHub Actions workflow
`.github/workflows/reminders-cron.yml` called it, scheduled every 15 minutes.

GitHub does not keep that schedule. The run history shows the workflow
running every 4 to 6 hours (for example 06:44, 12:46, 18:37, 22:38 UTC on
2026-10-27). A medication dose only counts as due for
`MEDICATION_REMINDER_WINDOW_MINUTES` (60) after its time, so most doses fell
between two runs and never got a push. Widening the window is not safe: a
push several hours late can lead to a dose at the wrong time.

## Decision

An external cron service (for example cron-job.org, free) calls the endpoint
every 5 to 15 minutes:

- URL: `https://api.pmaxing.pt/internal/reminders/run`
- Method: `POST`
- Header: `x-cron-secret: <same value as CRON_SECRET on Render>`
- Timeout: at least 60 seconds (Render can be waking up).

The GitHub workflow stays as a fallback. The endpoint is idempotent: doses
and deadlines already reminded are recorded (`MedicationDose.remindedAt`,
`SentReminder`), so two callers never send the same push twice.

## Consequences

Reminders arrive within the cron interval instead of hours late. The secret
now lives in one more place (the cron service), so rotating `CRON_SECRET`
means updating Render, the GitHub secret and the cron service together.
