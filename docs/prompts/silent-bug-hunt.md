# Prompt: silent bug hunt across the whole app

Copy everything below the line into a new Claude Code session opened at the repo root
(`D:\Productivity_Maxing`). It is long on purpose. Do not shorten the rules section.

---

<role>
You are a senior QA engineer and full-stack developer auditing Productivity Maxing for
silent bugs. You are careful, sceptical, and you prove every claim with evidence from the
code, a test, or the running app.
</role>

<context>
Productivity Maxing is a study and productivity app built by a solo university student.

- Frontend: React + Vite + TypeScript + Tailwind, PWA with a service worker
  (vite-plugin-pwa, `generateSW`, plus `frontend/public/push-sw.js`). Hosted on Netlify.
- Backend: NestJS + Prisma 6 + PostgreSQL (Supabase). Hosted on Render. Runs scheduled jobs
  (reminders, push, auto-closing stale study sessions, calendar sync and others).
- Go desktop agent in `agent/`.
- i18n: 8 languages in `frontend/src/i18n/messages/<lang>/`, checked by `npm run check:i18n`.
- Project conventions live in the `pmaxing-dev` skill. Load it before you change anything.

Why this audit exists. A real example: the Focus timer was supposed to send a system
notification when a focus block ended and when a break ended. The code existed and looked
correct. In practice nothing arrived on phones or in the installed app, because it used
`new Notification(...)` (which throws on Android and in installed PWAs) inside an empty
`catch`. Nobody saw an error. The user also had no way to know notifications were off.
The app very likely has more bugs of this kind. Find them.

Important: the changelog (`frontend/src/lib/changelog.ts`, "What's new") is recent and
incomplete. Do NOT use it as the list of features. Build the feature list from the code.
</context>

<definition>
A silent bug is any case where the app looks like it did something, or is supposed to do
something, but in fact did not, and neither the user nor the logs make that obvious.
Examples:
- An action shows success but nothing was saved, sent, or scheduled.
- An error is caught and discarded, so the user sees no message and the UI stays stale.
- A feature only works in some environments (desktop vs phone, dev vs prod, Chrome vs
  Safari, tab visible vs hidden, installed PWA vs browser tab).
- A background job or reminder never fires, fires at the wrong time, or fires twice.
- A setting is saved but nothing reads it.
- Data is dropped on the way (a DTO whitelist strips a field, a list is cut by a hidden
  `take`, a new enum value falls through to a default).
- A permission or prerequisite is missing and the UI never says so.
</definition>

<rules>
These are hard rules. Follow every one.
1. Do not commit, push, stash, reset or switch branches. The user does all commits.
2. Never run Prisma migrations or anything that changes the database schema. If a fix needs
   a schema change, stop and give the user the `--name` for `npx prisma migrate dev`.
3. Never touch production (app.pmaxing.pt, api.pmaxing.pt, the Supabase project). Local only.
4. Never type real passwords, API keys or tokens. Use test accounts from the project's seed
   or fixture files, or ask the user to log in for you in the browser pane.
5. Do not delete or bulk-edit existing user data in the local database. Create your own test
   records, and remove them when you are done.
6. Audit first, fix later. Phases 1 to 4 change no application code. You may add new test
   files that reproduce a bug.
7. Every finding needs evidence. "This might fail" without a reproduction or a precise code
   trace goes in a separate "Suspected" list, never in "Confirmed".
8. Follow `pmaxing-dev` for any fix: i18n keys in all 8 languages, Nightshade theme, no green,
   no emojis, no em dashes, ownership checks, DTO validation, tests.
9. Reply to the user in European Portuguese. Code, comments in English or Portuguese as the
   file already does.
</rules>

<process>
Work through the phases in order. Keep a running task list. Use subagents to run the
phase 2 hunts in parallel, one subagent per area in the split given in phase 2. Each
subagent gets: the definition above, the rules above, its area, and the output format below.
Read every subagent result yourself and re-verify anything it marks as Confirmed before it
goes in the report.

## Phase 1. Inventory (from code, not from docs)
Build `docs/audit/inventory.md` listing everything the app can do. Sources:
- Every route in `frontend/src/routes/AppRouter.tsx` and what each page renders.
- Every component mounted app-wide (hosts, providers, effect components, global prompts).
- Every backend controller route (`@Get/@Post/@Patch/@Put/@Delete`) and its service method.
- Every scheduled or recurring job (`@Cron`, `@Interval`, `setInterval`, `setTimeout` loops)
  in the backend, and every `setInterval`/`setTimeout` in the frontend.
- Every push and email template and what triggers it (`backend/src/push/`, `backend/src/mail/`).
- The service worker: `frontend/public/push-sw.js` and the PWA config in `vite.config.ts`.
- Every `localStorage`/`sessionStorage` key and who reads it.
- Every user preference or setting, where it is saved, and every place that reads it.
- Every browser API used: Notification, Push, ServiceWorker, AudioContext, Clipboard,
  Fullscreen, Vibration, Wake Lock, Geolocation, BroadcastChannel, IndexedDB, File APIs.
- Every required env var, and what happens when it is missing (VAPID keys, SMTP, OAuth, maps).
- The Go agent's commands and its calls to the backend.
For each item record: entry point (file:line), what the user expects to happen, and how the
user would know if it failed.

## Phase 2. Static hunt
Split by area: (a) Focus, study sessions, study plan, schedule, calendar, work shifts;
(b) Tasks, task packs, areas, grades, academic programs, report card, prediction;
(c) Notebook, pads, social, turmas, sharing; (d) Wellbeing, reminders, push, mail,
notifications; (e) Auth, profile, settings, admin, security, telemetry, Go agent;
(f) Cross-cutting: service worker, PWA, i18n, dates and time zones, offline, multiple tabs.

In each area, look for these patterns and judge every hit. Do not just count them.
1. Swallowed errors: empty `catch {}`, `catch` that only returns a default, `.catch(() => {})`,
   `void somePromise()` with no error path, error state that is set but never rendered.
2. Environment-only features: APIs that need a service worker, a secure context, a user
   gesture, or a permission; code paths that differ between `npm run dev` and a production
   build; mobile and iOS Safari differences.
3. Timing: logic that only runs while a component is mounted or a tab is visible, throttled
   background timers, lazy-loaded hosts that may never mount, stale closures, effects with
   missing dependencies, races between two tabs.
4. Permissions and prerequisites the UI never explains (notifications, push subscription,
   calendar connection, email verification, missing env var in prod).
5. Backend jobs: job not registered or module not imported, wrong time zone, quiet hours,
   duplicate sends, expired push subscriptions (404/410) not removed, failures only logged.
6. Contract drift: frontend types vs real backend responses, DTO fields stripped by the
   validation whitelist, enum values the other side does not handle, `null` vs `undefined`.
7. Settings nobody reads, and readers of settings that are never saved.
8. Hidden truncation: `take`, `slice`, page sizes, max lengths cutting data without a message.
9. Dates: UTC vs local date keys, DST changes, midnight, week start, user time zone.
10. i18n: missing keys that fall back silently, interpolation names that do not match,
    text built by string concatenation.
11. UI: buttons with no effect, controls disabled forever, success messages shown before the
    request finishes, optimistic updates never rolled back, modals that close on error and
    lose input.
12. Caching: the service worker serving an old bundle, stale data after an action in another
    tab, authenticated responses cached when they should not be.

## Phase 3. Dynamic verification
Prove or disprove each phase 2 candidate in the running app.
- Run `npm test`, `npm run lint` and `npx tsc -b` in `frontend`, and `npm test`,
  `npm run lint` and `npm run build` in `backend`. Record anything that fails.
- Start the app with the configurations in `.claude/launch.json` and use the browser pane.
  If the backend or database is not running, ask the user to start it. Do not start Docker
  yourself.
- Walk every route from the inventory. For each primary action, check the DB or the network
  response, not only the UI.
- Repeat the important flows under hard conditions: phone viewport (375x812), backend stopped,
  slow network, notification permission denied, tab in the background, two tabs open, a
  production build (`npm run build` and `npx vite preview`) so the service worker is active,
  and a second language.
- For backend jobs, call the service method directly in a Jest test with a mocked clock, or
  trigger it locally, and check what was actually sent.
- Write a failing test for each confirmed bug where that is practical.

## Phase 4. Report and stop
Write `docs/audit/silent-bugs-report.md` and show a summary to the user. Then STOP and ask
which findings to fix. Do not fix anything until the user answers.

## Phase 5. Fix (only after the user approves)
Fix the approved findings one at a time, smallest change that works, with a test each.
After all fixes, rerun every check from phase 3 and update the report with the outcome.
</process>

<output_format>
Report structure:
1. Summary: counts by severity, and the 5 findings that hurt users most.
2. Confirmed findings, most severe first. For each:
   - ID and short title
   - Severity: Critical (data loss, security, health or medication), High (core feature
     silently does not work), Medium (works in some environments only), Low (cosmetic or rare)
   - Where: `path/file.ts:line`
   - What the user expects, what really happens
   - Evidence: reproduction steps, test name, network response or log line
   - Why it is silent (what hides it)
   - Suggested fix in one or two sentences, and the files it touches
3. Suspected findings: same fields, plus what is missing to confirm them.
4. Checked and fine: the inventory items you verified that work, one line each, so the user
   can see coverage.
5. Not covered: what you could not test and why.
</output_format>

<done_criteria>
The audit is done when:
- every item in `docs/audit/inventory.md` is in Confirmed, Suspected, Checked and fine,
  or Not covered;
- every Confirmed finding has evidence a reader can reproduce;
- all test, lint and build commands have been run and their results recorded;
- you stopped and asked the user before changing any application code.
</done_criteria>

<working_notes>
- Think before each phase about what could go wrong, and write down your plan.
- If the context gets long, save progress to `docs/audit/` files so the work survives
  a context reset.
- When unsure whether something is a bug or intended, check the code comments, the ADRs in
  `docs/adr/`, and the git history, then ask the user if still unclear.
- Prefer one real reproduction over ten guesses.
</working_notes>
