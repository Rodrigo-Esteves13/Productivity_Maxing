// login-load-test.js
//
// Teste de carga controlado ao /auth/login local (Docker/localhost:3000).
// Objetivo: confirmar que o rate limiter e o pool de ligações à BD
// aguentam uma rajada realista, SEM crashar o backend nem esgotar o pool
// (o problema que já tiveste - ver LoggingThrottlerGuard/EMAXCONNSESSION).
//
// Correr: k6 run login-load-test.js
// Correr com mais VUs: k6 run --vus 100 --duration 30s login-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Contadores próprios para separar "bloqueado pelo rate limiter" (esperado,
// é o comportamento correto) de "erro real do servidor" (não esperado).
const rateLimited = new Counter('rate_limited_429');
const serverErrors = new Counter('server_errors_5xx');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },  // rampa suave
        { duration: '20s', target: 50 },  // sustentado
        { duration: '10s', target: 0 },   // rampa abaixo
      ],
    },
  },
  thresholds: {
    // A regra de ouro deste teste: nunca pode haver 500s. 429 é esperado
    // e correto (o rate limiter a fazer o trabalho dele); 500 significa
    // que algo por baixo rebentou (ex: pool de ligações esgotado outra vez).
    server_errors_5xx: ['count==0'],
    http_req_duration: ['p(95)<2000'], // p95 abaixo de 2s mesmo sob carga
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'a@a.com', password: 'x' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status === 429) rateLimited.add(1);
  if (res.status >= 500) serverErrors.add(1);

  check(res, {
    'status é 400 (credenciais inválidas) ou 429 (rate limited)': (r) =>
      r.status === 400 || r.status === 429,
    'nunca devolve 5xx': (r) => r.status < 500,
  });

  sleep(0.2); // imita o Start-Sleep -Milliseconds 200 do teu script original
}
