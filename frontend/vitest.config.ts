import { defineConfig } from 'vitest/config';

// Testes unitarios (logica pura em src/). Os de e2e/ sao do Playwright
// (npm run test:e2e) e o vitest nao os sabe correr.
export default defineConfig({
  test: {
    // scripts/: testes dos scripts de build (ex.: divisao do i18n).
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
