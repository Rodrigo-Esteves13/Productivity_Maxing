// Load test for the read-heavy pattern that actually happens during exam
// season: everyone opening the app repeatedly over a few hours to check
// grades/deadlines, not a steady trickle. Run with:
//
//   k6 run -e BASE_URL=https://your-backend.onrender.com \
//          -e TEST_EMAIL=loadtest@example.com \
//          -e TEST_PASSWORD=whatever-you-seeded \
//          backend/load-tests/exam-season.js
//
// Needs k6 installed (https://k6.io/docs/get-started/installation/) and
// a pre-seeded test account - same rule as the E2E tests
// (frontend/e2e/README.md): never point this at a real user's account,
// and think twice before running it against production at all (this
// generates real traffic and real load). A staging environment with
// production-like data volume is the right target.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.TEST_EMAIL;
const PASSWORD = __ENV.TEST_PASSWORD;

// Login is throttled to 5/min per IP (see auth.controller.ts) - same as
// a real browser, each VU logs in ONCE and reuses that session for every
// iteration afterwards, rather than re-authenticating every loop. This
// is cached at module scope: each k6 VU gets its own isolated JS runtime,
// so a module-level variable persists across that VU's iterations
// without needing k6's more heavyweight setup()/per-scenario machinery.
let cachedCsrfToken = null;

// Ramps up to simulate "everyone checks their deadlines around the same
// time" (right after a class, or the night before a deadline) rather
// than constant load - a flat VU count all test long wouldn't catch the
// kind of connection-pool/cold-cache pressure a real spike causes.
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // warm-up
    { duration: '1m', target: 50 }, // the actual spike
    { duration: '30s', target: 50 }, // held at peak
    { duration: '30s', target: 0 }, // cool-down
  ],
  thresholds: {
    // 95% of requests under 800ms, and fewer than 1% failing - tune
    // these once a first run establishes what "normal" looks like on
    // the real Render instance size; these are starting points, not
    // measured baselines.
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

function login() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login succeeded': (r) => r.status === 200 });
  // k6's http module keeps a per-VU cookie jar automatically - the
  // access_token cookie from this response is attached to every
  // subsequent request in this VU with no extra code needed.
  return res.json('csrfToken');
}

export default function () {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD (see the header comment above).');
  }

  if (!cachedCsrfToken) {
    cachedCsrfToken = login();
  }
  const authedHeaders = { headers: { 'X-CSRF-Token': cachedCsrfToken } };

  // The pages/requests someone actually hits when checking in on their
  // deadlines - dashboard load fans out into several reads at once, the
  // same way the real frontend does.
  const responses = http.batch([
    ['GET', `${BASE_URL}/tasks?periodId=all`, null, authedHeaders],
    ['GET', `${BASE_URL}/areas`, null, authedHeaders],
    ['GET', `${BASE_URL}/programs`, null, authedHeaders],
  ]);

  responses.forEach((res) => {
    check(res, { 'status is 200': (r) => r.status === 200 });
  });

  // A real user pauses to read the page, not fires requests back to
  // back - 2-5s between actions is a reasonable "glancing at the
  // dashboard" pace.
  sleep(Math.random() * 3 + 2);
}
