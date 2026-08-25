import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright bringt sein eigenes Laufwerk mit; Vitest laesst e2e/ liegen.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'server.ts'],
      exclude: ['src/**/*.test.ts', 'src/server/testhilfe.ts', 'src/types.ts'],
      // Die Schwelle darf nicht sinken. Sie wird in Schritt 4 auf den
      // gemessenen Stand gesetzt, nicht auf einen Wunschwert.
      // Gemessen am 2026-08-25: Lines 34.2 %, Functions 88.67 %,
      // Branches 84.35 %, Statements 34.2 %. Schwelle = abgerundeter
      // Messwert minus 2 (siehe task-7-report.md).
      thresholds: { lines: 32, functions: 86, branches: 82, statements: 32 },
    },
  },
});
