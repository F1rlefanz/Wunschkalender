import { describe, expect, it } from 'vitest';
import {
  GEPRUEFTE_WERKZEUGE,
  GESPERRTE_PFADE,
  MAX_GEAENDERTE_ZEILEN,
  MINDEST_BROWSERTESTS,
  fassungSinkt,
  istGesperrt,
  istRoutineZweig,
  pruefeSchranken,
  pruefeSkripte,
} from './routine-schranken.mjs';

/** Ein package.json, wie es heute aussieht — Grundlage fuer die Abwandlungen. */
const paket = {
  scripts: { test: 'vitest run', 'test:e2e': 'playwright test', lint: 'tsc --noEmit' },
  engines: { node: '>=22' },
  dependencies: { express: '^4.21.2' },
  devDependencies: { vitest: '^3.2.4' },
};

/** Ein Aufruf, bei dem alles in Ordnung ist — Grundlage fuer die Abwandlungen. */
const sauber = {
  dateien: ['src/components/Calendar.tsx', 'src/hinweise.ts'],
  geaenderteZeilen: 120,
  browsertests: 20,
  paketVorher: paket,
  paketNachher: paket,
};

describe('istGesperrt', () => {
  it('sperrt die Werkzeuge, die die Schranken selbst tragen', () => {
    // Eine Routine darf ihre eigene Sicherung nicht anfassen.
    expect(istGesperrt('tools/pruefe-schleuse.mjs')).toBe(true);
    expect(istGesperrt('tools/routine-schranken.mjs')).toBe(true);
    expect(istGesperrt('tools/pruefe-routine.mjs')).toBe(true);
  });

  it('sperrt die Konfiguration des Testnetzes', () => {
    // Ueber jede dieser Dateien laesst sich das Netz mit einem Zweizeiler
    // aushebeln, ohne einen einzigen Test anzufassen.
    expect(istGesperrt('vitest.config.ts')).toBe(true);
    expect(istGesperrt('playwright.config.ts')).toBe(true);
    expect(istGesperrt('tsconfig.json')).toBe(true);
  });

  it('sperrt package.json NICHT — sonst kaeme die Abhaengigkeiten-Routine nie durch', () => {
    // Ihre einzige Aufgabe ist, Pakete zu aktualisieren. Geschuetzt wird
    // gezielt der Skript-Teil, siehe pruefeSkripte.
    expect(istGesperrt('package.json')).toBe(false);
    expect(istGesperrt('package-lock.json')).toBe(false);
  });

  it('sperrt ganze Verzeichnisse ueber ihr Praefix', () => {
    expect(istGesperrt('.github/workflows/ci.yml')).toBe(true);
    expect(istGesperrt('.claude/settings.json')).toBe(true);
    expect(istGesperrt('.claude/skills/eskalation/SKILL.md')).toBe(true);
  });

  it('sperrt die sicherheitsnahen Serverbausteine', () => {
    expect(istGesperrt('src/server/passwords.ts')).toBe(true);
    expect(istGesperrt('src/server/session-store.ts')).toBe(true);
    expect(istGesperrt('src/server/session-secret.ts')).toBe(true);
    expect(istGesperrt('src/server/validierung.ts')).toBe(true);
  });

  it('sperrt die eigenen Regeln der Routinen', () => {
    expect(istGesperrt('docs/routinen.md')).toBe(true);
  });

  it('laesst gewoehnlichen Anwendungscode zu', () => {
    expect(istGesperrt('src/components/Calendar.tsx')).toBe(false);
    expect(istGesperrt('src/server/store.ts')).toBe(false);
    expect(istGesperrt('src/sperrfrist.ts')).toBe(false);
    expect(istGesperrt('README.md')).toBe(false);
  });

  it('laesst Testdateien ausdruecklich zu', () => {
    // Die Routine "Toter Code" soll nutzlose Tests entfernen duerfen. Das
    // Wegnehmen wird gezaehlt (Abdeckung, Mindestzahl), nicht verboten.
    expect(istGesperrt('src/sperrfrist.test.ts')).toBe(false);
    expect(istGesperrt('e2e/wuensche.spec.ts')).toBe(false);
  });

  it('laesst sich nicht durch einen Umweg im Pfad taeuschen', () => {
    // Wer `src/server/../../vitest.config.ts` schreibt, meint vitest.config.ts.
    expect(istGesperrt('src/server/../../vitest.config.ts')).toBe(true);
    expect(istGesperrt('./vitest.config.ts')).toBe(true);
  });

  it('unterscheidet nicht nach Gross- und Kleinschreibung', () => {
    // Linux tut es, Windows nicht. Wer sich darauf verlaesst, baut eine Luecke.
    expect(istGesperrt('Vitest.Config.ts')).toBe(true);
    expect(istGesperrt('.GitHub/workflows/ci.yml')).toBe(true);
  });
});

describe('pruefeSkripte', () => {
  it('laesst eine Aktualisierung von Abhaengigkeiten durch', () => {
    // Das ist die ganze Aufgabe der Routine "Abhaengigkeiten".
    const nachher = { ...paket, dependencies: { express: '^4.22.0' } };
    expect(pruefeSkripte(paket, nachher)).toEqual([]);
  });

  it('meldet ein umgebogenes Testskript', () => {
    // Der Zweizeiler, der das ganze Netz aushebeln wuerde.
    const nachher = { ...paket, scripts: { ...paket.scripts, test: 'echo ok' } };
    const probleme = pruefeSkripte(paket, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('test');
  });

  it('meldet ein entferntes Skript', () => {
    const { 'test:e2e': _weg, ...rest } = paket.scripts;
    const probleme = pruefeSkripte(paket, { ...paket, scripts: rest });
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('test:e2e');
  });

  it('laesst ein zusaetzliches Skript zu', () => {
    // Etwas hinzuzufuegen nimmt keinem Beweis seine Kraft.
    const nachher = { ...paket, scripts: { ...paket.scripts, 'neu:irgendwas': 'node x.mjs' } };
    expect(pruefeSkripte(paket, nachher)).toEqual([]);
  });

  it('meldet eine gesenkte Node-Anforderung', () => {
    // Node 20 laesst better-sqlite3 hart abstuerzen — genau so ist die CI
    // schon einmal tagelang unbemerkt rot gewesen.
    const nachher = { ...paket, engines: { node: '>=18' } };
    const probleme = pruefeSkripte(paket, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('engines');
  });

  it('kommt mit einem fehlenden package.json zurecht', () => {
    // Beruehrt ein Pull-Request die Datei gar nicht, gibt es nichts zu melden.
    expect(pruefeSkripte(null, null)).toEqual([]);
  });

  it('meldet ein neues postinstall-Skript', () => {
    // npm ci fuehrt es ohne Zutun aus, noch bevor irgendeine Pruefung laeuft.
    const nachher = { ...paket, scripts: { ...paket.scripts, postinstall: 'node aendere-etwas.mjs' } };
    const probleme = pruefeSkripte(paket, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('postinstall');
  });

  it('meldet jedes neue Lifecycle-Skript aus der Liste', () => {
    for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack', 'postpack']) {
      const nachher = { ...paket, scripts: { ...paket.scripts, [name]: 'node x.mjs' } };
      const probleme = pruefeSkripte(paket, nachher);
      expect(probleme.some((p) => p.includes(name))).toBe(true);
    }
  });

  it('meldet ein neu eingefuegtes overrides-Feld', () => {
    const nachher = { ...paket, overrides: { vitest: '2.0.0' } };
    const probleme = pruefeSkripte(paket, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('overrides');
  });

  it('meldet ein neu eingefuegtes resolutions-Feld', () => {
    const nachher = { ...paket, resolutions: { vitest: '2.0.0' } };
    const probleme = pruefeSkripte(paket, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('resolutions');
  });

  it('laesst ein bestehendes overrides-Feld unveraendert zu', () => {
    const mitOverrides = { ...paket, overrides: { vitest: '3.2.4' } };
    const nachher = { ...mitOverrides, dependencies: { express: '^4.22.0' } };
    expect(pruefeSkripte(mitOverrides, nachher)).toEqual([]);
  });

  it('meldet eine gesenkte Fassung eines Pruefwerkzeugs', () => {
    const mitVitest = { ...paket, devDependencies: { ...paket.devDependencies, vitest: '^3.2.4' } };
    const nachher = { ...mitVitest, devDependencies: { ...mitVitest.devDependencies, vitest: '^2.9.0' } };
    const probleme = pruefeSkripte(mitVitest, nachher);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('vitest');
  });

  it('laesst eine gestiegene Fassung eines Pruefwerkzeugs zu', () => {
    const mitVitest = { ...paket, devDependencies: { ...paket.devDependencies, vitest: '^3.2.4' } };
    const nachher = { ...mitVitest, devDependencies: { ...mitVitest.devDependencies, vitest: '^3.3.0' } };
    expect(pruefeSkripte(mitVitest, nachher)).toEqual([]);
  });
});

describe('fassungSinkt', () => {
  it('erkennt eine gesunkene Fassung ueber die fuehrenden Zahlen', () => {
    expect(fassungSinkt('^3.2.4', '^2.9.0')).toBe(true);
  });

  it('laesst eine gestiegene Fassung zu', () => {
    expect(fassungSinkt('^3.2.4', '^3.3.0')).toBe(false);
  });

  it('kommt mit ~ und exakten Fassungen zurecht', () => {
    expect(fassungSinkt('~1.62.1', '1.62.0')).toBe(true);
    expect(fassungSinkt('1.62.1', '~1.63.0')).toBe(false);
  });

  it('behandelt eine gleichgebliebene Fassung als nicht gesunken', () => {
    expect(fassungSinkt('^3.2.4', '^3.2.4')).toBe(false);
  });

  it('behandelt einen fehlenden Eintrag danach als Sinken', () => {
    expect(fassungSinkt('^3.2.4', undefined)).toBe(true);
  });

  it('behandelt einen fehlenden Eintrag davor als kein Sinken', () => {
    expect(fassungSinkt(undefined, '^3.2.4')).toBe(false);
  });

  it('haelt die Liste der gepruefte Werkzeuge fest', () => {
    expect(GEPRUEFTE_WERKZEUGE).toEqual(['vitest', '@vitest/coverage-v8', '@playwright/test', 'typescript']);
  });
});

describe('pruefeSchranken', () => {
  it('laesst einen unauffaelligen Pull-Request durch', () => {
    expect(pruefeSchranken(sauber)).toEqual({ ok: true, probleme: [] });
  });

  it('nennt jeden beruehrten gesperrten Pfad einzeln', () => {
    const ergebnis = pruefeSchranken({
      ...sauber,
      dateien: ['src/hinweise.ts', 'vitest.config.ts', '.github/workflows/ci.yml'],
    });
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.probleme).toHaveLength(1);
    expect(ergebnis.probleme[0]).toContain('vitest.config.ts');
    expect(ergebnis.probleme[0]).toContain('.github/workflows/ci.yml');
    expect(ergebnis.probleme[0]).not.toContain('src/hinweise.ts');
  });

  it('weist genau ab 401 geaenderten Zeilen ab', () => {
    // Die Grenze selbst ist noch erlaubt: 400 heisst "hoechstens 400".
    expect(pruefeSchranken({ ...sauber, geaenderteZeilen: 400 }).ok).toBe(true);
    const zuGross = pruefeSchranken({ ...sauber, geaenderteZeilen: 401 });
    expect(zuGross.ok).toBe(false);
    expect(zuGross.probleme[0]).toContain('401');
    expect(zuGross.probleme[0]).toContain('400');
  });

  it('weist ab, wenn Browsertests verschwunden sind', () => {
    // Die Abdeckungsschwelle faengt das NICHT: e2e/ zaehlt nicht in die Messung.
    const ergebnis = pruefeSchranken({ ...sauber, browsertests: 19 });
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.probleme[0]).toContain('19');
    expect(ergebnis.probleme[0]).toContain('20');
  });

  it('laesst zusaetzliche Browsertests zu', () => {
    expect(pruefeSchranken({ ...sauber, browsertests: 25 }).ok).toBe(true);
  });

  it('meldet mehrere Verstoesse zusammen, nicht nur den ersten', () => {
    // Sonst braucht eine Routine drei Laeufe, um drei Probleme zu erfahren.
    const ergebnis = pruefeSchranken({
      dateien: ['vitest.config.ts'],
      geaenderteZeilen: 900,
      browsertests: 3,
      paketVorher: paket,
      paketNachher: { ...paket, scripts: { ...paket.scripts, test: 'echo ok' } },
    });
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.probleme).toHaveLength(4);
  });

  it('haelt die festgelegten Werte ein', () => {
    // Wer diese Zahlen aendert, aendert eine Absprache — der Test soll das zeigen.
    expect(MAX_GEAENDERTE_ZEILEN).toBe(400);
    expect(MINDEST_BROWSERTESTS).toBe(20);
    expect(GESPERRTE_PFADE.length).toBeGreaterThan(10);
  });
});

describe('istRoutineZweig', () => {
  it('erkennt Routine-Zweige unabhaengig von Tiefe und Datum', () => {
    expect(istRoutineZweig('routine/toter-code/2026-09-01')).toBe(true);
    expect(istRoutineZweig('routine/x')).toBe(true);
  });

  it('lehnt aehnlich klingende, aber falsche Namen ab', () => {
    expect(istRoutineZweig('wartung/x')).toBe(false);
    expect(istRoutineZweig('routines/x')).toBe(false);
  });

  it('lehnt einen leeren oder fehlenden Namen ab', () => {
    expect(istRoutineZweig('')).toBe(false);
    expect(istRoutineZweig(undefined)).toBe(false);
    expect(istRoutineZweig(null)).toBe(false);
  });

  it('ist unabhaengig von Gross- und Kleinschreibung, wie GitHub selbst', () => {
    expect(istRoutineZweig('Routine/X')).toBe(true);
  });
});
