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
      // Die Schwelle darf nicht sinken. Sie wird gemessen, nicht geraten:
      // je Wert der gemessene Stand, abgerundet, minus zwei Punkte Luft
      // (siehe task-7-report.md). Zwei Ebenen, nicht nur eine:
      //
      // Der Gesamtwert (unten) wird von rund 2000 Zeilen noch ungetesteter
      // Oberflaeche (Calendar.tsx, App.tsx, UserManagement.tsx, client.ts, ...)
      // gedaempft und liegt deshalb bei nur ~34 %. Auf dieser Mischzahl
      // koennte der gut getestete Server- und Logikteil spuerbar an
      // Abdeckung verlieren, ohne die zwei Punkte Luft aufzubrauchen — die
      // ungetestete Oberflaeche schluckt die Bewegung. Die eigentliche
      // Sperre gegen ein weggekuerztes Testfeld sind deshalb die
      // Bereichsschwellen je Glob-Muster unten; der Gesamtwert bleibt nur
      // als grobe Untergrenze gegen einen Totalausfall.
      //
      // Gemessen am 2026-08-25 (npx vitest run --coverage --coverage.reporter=text):
      // Gesamt      — Statements 34.2 %, Branches 84.35 %, Functions 88.67 %, Lines 34.2 %
      // src/server  — Statements 94.45 %, Branches 85.61 %, Functions 100 %, Lines 94.45 %
      // Logikdateien — Statements 98.57 %, Branches 91.30 %, Functions 100 %, Lines 98.57 %
      thresholds: {
        lines: 32,
        functions: 86,
        branches: 82,
        statements: 32,
        // Serverseitige Logik (Store, Validierung, Passwoerter, Migration, ...).
        'src/server/**': { statements: 92, branches: 83, functions: 98, lines: 92 },
        // Reine, von der Oberflaeche unabhaengige Logikdateien in src/ selbst
        // (Sperrfrist, Export, Hinweise, Gestaltung, Einstellungen).
        'src/{sperrfrist,export,hinweise,gestaltung,einstellungen}.ts': {
          statements: 96,
          branches: 89,
          functions: 98,
          lines: 96,
        },
      },
    },
  },
});
