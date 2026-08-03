# E2E tests (Playwright)

## One-time setup

```bash
cd frontend
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Add to `frontend/package.json`:

```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

## Test account

`auth.setup.ts` and `auth.spec.ts`'s "logs in" test both need a real,
pre-seeded account to log in with - **never point these at a production
database or a real user's credentials.** Point the backend at a local or
staging database, seed one account there, and set:

```bash
export E2E_TEST_EMAIL="e2e@example.com"
export E2E_TEST_PASSWORD="whatever-you-seeded"
```

Without these two set, `auth.setup.ts` fails outright (the `authenticated`
project depends on it, so every test in `tasks.spec.ts` would fail too),
and the "logs in" test in `auth.spec.ts` skips itself - the "wrong
credentials" test in the same file doesn't need an account at all, so it
still runs.

## Running

```bash
# Backend running locally (or E2E_BASE_URL pointed at a deployed preview)
npm run test:e2e          # headless, once
npm run test:e2e:ui       # interactive - the best way to write new tests
```

`playwright.config.ts` starts the Vite dev server for you locally
(`reuseExistingServer: true` - if one's already running on port 5173, it's
reused instead of a second one being started). In CI, the workflow starts
both the backend and frontend itself and passes `E2E_BASE_URL` (see
`.github/workflows/ci.yml`).

## Adding a test

- Put it in `e2e/`, name it `*.spec.ts`.
- Needs to be logged in? It'll automatically pick up the saved session
  from `auth.setup.ts` (the `authenticated` project applies
  `storageState: 'e2e/.auth/user.json'` to every `*.spec.ts` file except
  `auth.spec.ts` itself) - no per-test login needed.
- Prefer `getByRole` / `getByLabel` over CSS selectors - matches how a
  real user (or a screen reader) finds the element, and survives styling
  changes that would break a class-name selector.
