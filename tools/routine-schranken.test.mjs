import { describe, expect, it } from 'vitest';
import {
  GEPRUEFTE_WERKZEUGE,
  GESPERRTE_PFADE,
  MAX_GEAENDERTE_ZEILEN,
  MINDEST_BROWSERTESTS,
  fassungSinkt,
  istGesperrt,
  istRoutineZweig,
  pruefeE2eAbschaltungen,
  pruefeE2eZusicherungen,
  pruefeKomponentenUndE2eGetrennt,
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

  it('sperrt das ganze tools/-Verzeichnis, nicht nur einzelne Dateien', () => {
    // Ein neues Werkzeug in tools/ (etwa ein spaeterer SessionStart-Hook)
    // laeuft auf dem Rechner des Betreibers und darf nicht ungeschuetzt sein.
    expect(istGesperrt('tools/sitzungsstart.mjs')).toBe(true);
    expect(istGesperrt('tools/irgendein-neues-werkzeug.mjs')).toBe(true);
  });

  it('sperrt CLAUDE.md — sie liegt im Kontext des Torwaechters selbst', () => {
    expect(istGesperrt('CLAUDE.md')).toBe(true);
  });

  it('sperrt src/server/app.ts — traegt requireAuth/requireManager', () => {
    expect(istGesperrt('src/server/app.ts')).toBe(true);
  });

  it('sperrt .github/ vollstaendig, nicht nur .github/workflows/', () => {
    expect(istGesperrt('.github/workflows/ci.yml')).toBe(true);
    expect(istGesperrt('.github/actions/irgendwas/action.yml')).toBe(true);
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

  it('meldet ein neues "pre<name>"-Skript zu einem bestehenden eigenen Skript', () => {
    // npm fuehrt "npm run pruefe:routine" nie ohne dieses Hook-Skript aus -
    // gerade DAS Skript, das die Schranken selbst aufruft, ist betroffen.
    const mitEigenemSkript = { ...paket, scripts: { ...paket.scripts, 'pruefe:routine': 'node tools/pruefe-routine.mjs' } };
    const nachher = { ...mitEigenemSkript, scripts: { ...mitEigenemSkript.scripts, 'prepruefe:routine': 'node beliebig.mjs' } };
    const probleme = pruefeSkripte(mitEigenemSkript, nachher);
    expect(probleme.some((p) => p.includes('prepruefe:routine'))).toBe(true);
  });

  it('meldet ein neues "pre<name>"-Skript zu test:coverage', () => {
    const mitCoverage = { ...paket, scripts: { ...paket.scripts, 'test:coverage': 'vitest run --coverage' } };
    const nachher = { ...mitCoverage, scripts: { ...mitCoverage.scripts, 'pretest:coverage': 'node beliebig.mjs' } };
    const probleme = pruefeSkripte(mitCoverage, nachher);
    expect(probleme.some((p) => p.includes('pretest:coverage'))).toBe(true);
  });

  it('laesst ein neues Skript zu, dessen "pre"/"post"-Ziel gar nicht existiert', () => {
    // "prefix-irgendwas" beginnt zufaellig mit "pre", ist aber kein Hook zu
    // einem echten Skript "fix-irgendwas" - das darf nicht mitgefangen werden.
    const nachher = { ...paket, scripts: { ...paket.scripts, 'prefix-irgendwas': 'node x.mjs' } };
    expect(pruefeSkripte(paket, nachher)).toEqual([]);
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

describe('pruefeE2eZusicherungen', () => {
  it('laesst eine gleichbleibende oder steigende Zahl zu', () => {
    expect(pruefeE2eZusicherungen([{ pfad: 'e2e/wuensche.spec.ts', vorher: 5, nachher: 5 }])).toEqual([]);
    expect(pruefeE2eZusicherungen([{ pfad: 'e2e/wuensche.spec.ts', vorher: 5, nachher: 7 }])).toEqual([]);
  });

  it('meldet eine gesunkene Zahl mit Dateiname', () => {
    const probleme = pruefeE2eZusicherungen([{ pfad: 'e2e/wuensche.spec.ts', vorher: 5, nachher: 3 }]);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('e2e/wuensche.spec.ts');
    expect(probleme[0]).toContain('5');
    expect(probleme[0]).toContain('3');
  });

  it('meldet mehrere betroffene Dateien einzeln', () => {
    const probleme = pruefeE2eZusicherungen([
      { pfad: 'e2e/a.spec.ts', vorher: 4, nachher: 1 },
      { pfad: 'e2e/b.spec.ts', vorher: 2, nachher: 2 },
      { pfad: 'e2e/c.spec.ts', vorher: 3, nachher: 0 },
    ]);
    expect(probleme).toHaveLength(2);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(pruefeE2eZusicherungen([])).toEqual([]);
    expect(pruefeE2eZusicherungen(undefined)).toEqual([]);
  });
});

describe('pruefeKomponentenUndE2eGetrennt', () => {
  it('weist ab, wenn beide Bereiche im selben Pull-Request stehen', () => {
    const probleme = pruefeKomponentenUndE2eGetrennt(['src/components/Calendar.tsx', 'e2e/wuensche.spec.ts']);
    expect(probleme).toHaveLength(1);
  });

  it('laesst Aenderungen nur an Komponenten zu', () => {
    expect(pruefeKomponentenUndE2eGetrennt(['src/components/Calendar.tsx', 'src/hinweise.ts'])).toEqual([]);
  });

  it('laesst Aenderungen nur an e2e-Tests zu', () => {
    expect(pruefeKomponentenUndE2eGetrennt(['e2e/wuensche.spec.ts'])).toEqual([]);
  });

  it('laesst weder Komponenten noch e2e beruehrt zu', () => {
    expect(pruefeKomponentenUndE2eGetrennt(['README.md'])).toEqual([]);
  });
});

describe('pruefeE2eAbschaltungen', () => {
  it('meldet ein neu hinzugefuegtes test.skip', () => {
    const diff = ['diff --git a/e2e/x.spec.ts b/e2e/x.spec.ts', '+test.skip(\'etwas\', async () => {})'].join('\n');
    const probleme = pruefeE2eAbschaltungen(diff);
    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain('test.skip(');
  });

  it('meldet test.fixme und test.fail ebenso', () => {
    expect(pruefeE2eAbschaltungen("+test.fixme('etwas', async () => {})")[0]).toContain('test.fixme(');
    expect(pruefeE2eAbschaltungen("+test.fail('etwas', async () => {})")[0]).toContain('test.fail(');
  });

  it('ignoriert entfernte Zeilen und Kontext', () => {
    const diff = ["-test.skip('etwas', async () => {})", " test.skip('anderes', async () => {})"].join('\n');
    expect(pruefeE2eAbschaltungen(diff)).toEqual([]);
  });

  it('ignoriert die Dateikopfzeilen des Diffs (+++/---), auch wenn der Dateiname wie ein Treffer aussieht', () => {
    // Ohne die +++-Ausnahme wuerde diese Kopfzeile selbst als Treffer zaehlen
    // (das Muster "test.skip(" steckt im Dateinamen) - der Test waere sonst
    // auch dann gruen, wenn die Ausnahme geloescht wuerde.
    const diff = '+++ b/e2e/test.skip(legacy).spec.ts';
    expect(pruefeE2eAbschaltungen(diff)).toEqual([]);
  });

  it('kommt mit leerem Diff zurecht', () => {
    expect(pruefeE2eAbschaltungen('')).toEqual([]);
    expect(pruefeE2eAbschaltungen(undefined)).toEqual([]);
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

  it('bindet die e2e-Zusicherungspruefung ein', () => {
    const ergebnis = pruefeSchranken({
      ...sauber,
      e2eZusicherungen: [{ pfad: 'e2e/wuensche.spec.ts', vorher: 5, nachher: 2 }],
    });
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.probleme[0]).toContain('e2e/wuensche.spec.ts');
  });

  it('bindet die Trennung von Komponenten und e2e-Tests ein', () => {
    const ergebnis = pruefeSchranken({
      ...sauber,
      dateien: ['src/components/Calendar.tsx', 'e2e/wuensche.spec.ts'],
    });
    expect(ergebnis.ok).toBe(false);
  });

  it('bindet die Pruefung auf neue e2e-Abschaltungen ein', () => {
    const ergebnis = pruefeSchranken({
      ...sauber,
      e2eDiffText: "+test.skip('etwas', async () => {})",
    });
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.probleme[0]).toContain('test.skip(');
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
