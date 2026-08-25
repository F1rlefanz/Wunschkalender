# Routine-Schranken Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die mechanischen Schranken bauen, die einen `routine/*`-Pull-Request in der CI abweisen, wenn er gesperrte Pfade beruehrt, zu gross ist oder Browsertests wegnimmt — damit keine dieser Grenzen am Wohlverhalten eines Sprachmodells haengt.

**Architecture:** Die Pruefregeln liegen als **reine Funktionen** in `tools/routine-schranken.mjs` (keine Git-Aufrufe, keine Seiteneffekte) und sind damit per Vitest testbar — dem Muster von `tools/changelog-pruefung.mjs` folgend. Ein duenner Aufrufer `tools/pruefe-routine.mjs` sammelt die Tatsachen (Diff gegen `main`, Anzahl der Browsertests) und reicht sie hinein. Ein eigener CI-Auftrag ruft nur diesen Aufrufer und laeuft ausschliesslich fuer Zweige, deren Name mit `routine/` beginnt.

**Tech Stack:** Node 24 (ESM `.mjs`), Vitest 3, GitHub Actions, Playwright (nur `--list`, kein Browser noetig).

**Spec:** `docs/superpowers/specs/2026-08-25-autonome-wartung-design.md` (Teil 2, Abschnitt „Die Schranken gehoeren in die CI, nicht in den Prompt")

## Global Constraints

- **Sprache:** Bezeichner, Kommentare und Testnamen auf Deutsch, keine Umlaute in Dateinamen. Dem Stil von `tools/changelog-pruefung.mjs` folgen.
- **Kein CHANGELOG-Eintrag** fuer die Commits dieses Plans — es sind `test:`, `ci:`, `chore:` und `docs:`-Commits, und `tools/pruefe-schleuse.mjs` (Zeile 74) befreit diese Praefixe ausdruecklich davon. Nur `feat:`/`fix:` verlangen einen Eintrag.
- **Commit-Trailer:** jeder Commit endet mit
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Branch:** alles auf `feature/routine-schranken`, abgezweigt von `main`. Nicht auf `main` committen.
- **Node >= 22** (`package.json` `engines`); die CI faehrt `node-version: '24'`.
- **`tsconfig` ist nicht `strict`.** Kein neues `any`. `.mjs`-Dateien unter `tools/` werden von `tsc` nicht erfasst — dafuer muessen ihre Tests umso genauer sein.
- **Feste Werte, die woertlich zu uebernehmen sind:**
  - Diff-Obergrenze: **400** geaenderte Zeilen
  - Mindestzahl Browsertests: **20** (heutiger Stand, `npx playwright test --list` meldet „Total: 20 tests in 7 files")
  - Abdeckungsschwellen (bereits gesetzt, nicht anfassen): gesamt 32/86/82/32, `src/server/**` 92/83/98/92, Logikdateien 96/89/98/96

---

## Zwei Entscheidungen, die dieser Plan gegenueber der Spezifikation trifft

Beide sind bewusst und gehoeren in `docs/routinen.md` begruendet.

**1. Testdateien werden NICHT gesperrt.** Die Spezifikation listet unter den
gesperrten Pfaden „die Testdateien des Netzes selbst". Das widerspricht der
Routine „Toter Code", die ausdruecklich *Tests ohne Zusicherung entfernen* soll.
Beides zugleich geht nicht.

Aufloesung: Testdateien bleiben aenderbar, aber das Wegnehmen wird **gezaehlt**
statt verboten — die Mindestzahl Browsertests und die Abdeckungsschwellen fangen
genau das ab. Eine Routine darf also einen nutzlosen Test entfernen, wenn dabei
die Abdeckung nicht unter die Schwelle faellt und die Zahl der Browsertests
nicht sinkt. Das ist die Grenze, die der Sache entspricht: Nicht „Tests sind
unantastbar", sondern „der Beweiswert darf nicht sinken".

**2. „Abdeckung nicht gesunken" wird von den vorhandenen Schwellen erledigt,
nicht noch einmal gebaut.** Die Spezifikation nennt es als eigene Pruefung des
Routine-Auftrags. Der `pruefen`-Auftrag erzwingt die Schwellen aber bereits bei
jedem Lauf. Eine zusaetzliche Pruefung „gegenueber `main` nicht gesunken"
braeuchte einen gespeicherten Vergleichswert und zwei Abdeckungslaeufe je
Pull-Request — viel Mechanik fuer wenig Gewinn.

Die bewusste Luecke dabei: Zwischen gemessenem Wert (z. B. 94,45 %) und Schwelle
(92) liegen zwei Punkte Spielraum, die eine Routine aufbrauchen koennte, ohne
dass etwas rot wird. Das ist der Preis dafuer, dass eine harmlose Zeile die CI
nicht rot faerbt, und war bei der Festlegung der Schwellen so entschieden. Es
gehoert nach `docs/routinen.md`, damit es niemand fuer ein Versehen haelt.

---

## Dateien im Ueberblick

| Datei | Verantwortung |
|---|---|
| `tools/routine-schranken.mjs` (neu) | Die Regeln als reine Funktionen. Kein `git`, kein Dateisystem, keine Ausgabe. Testbar. |
| `tools/routine-schranken.test.mjs` (neu) | Vitest-Tests dazu, Muster wie `tools/changelog-pruefung.test.mjs`. |
| `tools/pruefe-routine.mjs` (neu) | Aufrufer: sammelt Diff und Testzahl, ruft die reinen Funktionen, schreibt eine lesbare Meldung, Exit 0 oder 1. |
| `docs/routinen.md` (neu) | Der gemeinsame Rahmen, auf den die spaeteren Routinen verweisen. |
| `.github/workflows/ci.yml` (aendern) | Neuer Auftrag `schranken`, nur fuer Zweige, die mit `routine/` beginnen. |
| `package.json` (aendern) | Skript `pruefe:routine`. Steht bewusst **nicht** auf der Sperrliste — die Routine „Abhaengigkeiten" muss es aendern duerfen; geschuetzt sind gezielt `scripts` und `engines`. |
| `playwright.config.ts` (aendern) | `forbidOnly` unter CI, damit ein vergessenes `test.only` nicht 19 Tests stilllegt. |

Warum die Zweiteilung in „reine Regeln" und „Aufrufer": Die Regeln sind das,
was schiefgehen kann und deshalb geprueft gehoert. Der Aufrufer ruft `git` und
`playwright` — beides in einem Unit-Test nachzubauen kostet mehr, als es
einbringt. Er bleibt deshalb so duenn, dass man ihn ansehen kann.

---

## Task 1: Die Regeln als reine Funktionen

**Files:**
- Create: `tools/routine-schranken.mjs`
- Create: `tools/routine-schranken.test.mjs`

**Interfaces:**
- Consumes: nichts.
- Produces:
  ```js
  export const MAX_GEAENDERTE_ZEILEN = 400;
  export const MINDEST_BROWSERTESTS = 20;
  export const GESPERRTE_PFADE = [ /* Praefixe und exakte Pfade, siehe unten */ ];
  export function istGesperrt(pfad): boolean;
  export function pruefeSkripte(vorher, nachher): string[];
  export function pruefeSchranken({ dateien, geaenderteZeilen, browsertests, paketVorher, paketNachher }): { ok: boolean, probleme: string[] };
  ```
  `dateien` ist ein Array von Pfaden mit `/` als Trenner, `geaenderteZeilen` eine
  Zahl (Summe aus Hinzugefuegt und Entfernt), `browsertests` eine Zahl.
  `paketVorher` und `paketNachher` sind die geparsten Inhalte von `package.json`
  vor und nach der Aenderung (Objekte, nicht Text).

- [ ] **Step 1: Den scheiternden Test schreiben**

Erstelle `tools/routine-schranken.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import {
  GESPERRTE_PFADE,
  MAX_GEAENDERTE_ZEILEN,
  MINDEST_BROWSERTESTS,
  istGesperrt,
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
```

- [ ] **Step 2: Test laufen lassen, Scheitern bestaetigen**

Run: `npx vitest run tools/routine-schranken.test.mjs`
Expected: FAIL — `Cannot find module './routine-schranken.mjs'`

- [ ] **Step 3: Die Regeln schreiben**

Erstelle `tools/routine-schranken.mjs`:

```js
/**
 * Die Schranken fuer `routine/*`-Zweige, als reine Funktionen.
 *
 * Warum hier und nicht im Prompt der Routine: Eine Anweisung an ein
 * Sprachmodell reicht fuer Gewohnheiten, nicht fuer Grenzen. Diese Datei wird
 * von der CI aufgerufen und ist selbst getestet — sie kann nicht
 * missverstanden werden.
 *
 * Kein `git`, kein Dateisystem, keine Ausgabe. Wer Tatsachen sammelt, ist
 * `tools/pruefe-routine.mjs`.
 */

/** Hoechstens so viele geaenderte Zeilen (hinzugefuegt plus entfernt). */
export const MAX_GEAENDERTE_ZEILEN = 400;

/**
 * So viele Browsertests muss es mindestens geben.
 *
 * Diese Zahl ist noetig, weil `e2e/**` nicht in die Abdeckungsmessung eingeht:
 * Ein stillgelegter oder geloeschter Browsertest senkt keine Schwelle. Die
 * ganze Oberflaeche haengt aber an diesen Tests.
 *
 * Kommen Tests dazu, darf die Zahl steigen. Sie zu SENKEN ist eine Entscheidung,
 * die ein Mensch treffen muss — nicht eine Routine.
 */
export const MINDEST_BROWSERTESTS = 20;

/**
 * Was keine erzeugende Routine anfassen darf.
 *
 * Ein Eintrag mit `/` am Ende ist ein Verzeichnis-Praefix, alles andere ein
 * genauer Pfad. Testdateien stehen bewusst NICHT darauf — siehe docs/routinen.md.
 */
export const GESPERRTE_PFADE = [
  // Die Sicherungen selbst.
  '.github/workflows/',
  '.claude/',
  'tools/pruefe-schleuse.mjs',
  'tools/changelog-pruefung.mjs',
  'tools/routine-schranken.mjs',
  'tools/pruefe-routine.mjs',
  'docs/routinen.md',
  // Die Konfiguration des Testnetzes: ueber jede dieser Dateien laesst es sich
  // mit einem Zweizeiler aushebeln, ohne einen Test anzufassen.
  'vitest.config.ts',
  'playwright.config.ts',
  'tsconfig.json',
  // `package.json` steht bewusst NICHT hier: Die Routine "Abhaengigkeiten" hat
  // als einzige Aufgabe, Pakete zu aktualisieren — eine Sperre haette sie ab
  // dem ersten Lauf blockiert. Geschuetzt wird stattdessen gezielt der Teil,
  // ueber den sich das Netz aushebeln liesse: siehe pruefeSkripte.
  // Sicherheitsnahe Serverbausteine.
  'src/server/passwords.ts',
  'src/server/session-store.ts',
  'src/server/session-secret.ts',
  'src/server/validierung.ts',
];

/** Normalisiert einen Pfad: `\` zu `/`, `./` und `..` aufgeloest, klein. */
function normalisiere(pfad) {
  const teile = [];
  for (const stueck of String(pfad).replace(/\\/g, '/').split('/')) {
    if (stueck === '' || stueck === '.') continue;
    if (stueck === '..') teile.pop();
    else teile.push(stueck);
  }
  return teile.join('/').toLowerCase();
}

/**
 * Liegt dieser Pfad auf der Sperrliste?
 *
 * Ohne Ruecksicht auf Gross- und Kleinschreibung: Linux unterscheidet sie,
 * Windows nicht. Wer sich auf die Schreibweise verlaesst, baut eine Luecke.
 */
export function istGesperrt(pfad) {
  const norm = normalisiere(pfad);
  return GESPERRTE_PFADE.some((eintrag) => {
    const ziel = normalisiere(eintrag);
    return eintrag.endsWith('/') ? norm === ziel || norm.startsWith(`${ziel}/`) : norm === ziel;
  });
}

/**
 * Vergleicht die Teile von `package.json`, die das Testnetz tragen.
 *
 * `package.json` steht nicht auf der Sperrliste, weil die Routine
 * "Abhaengigkeiten" genau diese Datei aendern muss. Geschuetzt werden deshalb
 * gezielt zwei Stellen:
 *
 * - **`scripts`** — `test`, `test:coverage`, `test:e2e` und `lint` umzubiegen
 *   waere der Zweizeiler, der jede Pruefung ins Leere laufen laesst, ohne dass
 *   ein einziger Test angefasst wird.
 * - **`engines`** — die Node-Untergrenze abzusenken bringt die CI zum harten
 *   Absturz statt zu einem lesbaren Fehlschlag. Genau so war sie in diesem
 *   Projekt schon einmal tagelang unbemerkt rot.
 *
 * Hinzufuegen ist erlaubt, Aendern und Entfernen nicht.
 */
export function pruefeSkripte(vorher, nachher) {
  if (!vorher || !nachher) return [];
  const probleme = [];

  for (const [name, befehl] of Object.entries(vorher.scripts ?? {})) {
    const jetzt = (nachher.scripts ?? {})[name];
    if (jetzt === undefined) {
      probleme.push(`Das Skript "${name}" wurde entfernt. Skripte tragen die Pruefungen — sie sind nicht Sache einer Routine.`);
    } else if (jetzt !== befehl) {
      probleme.push(`Das Skript "${name}" wurde geaendert (war: ${befehl}, jetzt: ${jetzt}). Skripte umzubiegen laesst jede Pruefung ins Leere laufen.`);
    }
  }

  const vorherNode = (vorher.engines ?? {}).node;
  const nachherNode = (nachher.engines ?? {}).node;
  if (vorherNode !== nachherNode) {
    probleme.push(`Die Node-Anforderung in "engines" wurde geaendert (war: ${vorherNode}, jetzt: ${nachherNode}). Eine zu niedrige Untergrenze laesst die CI abstuerzen statt lesbar scheitern.`);
  }

  return probleme;
}

/**
 * Prueft einen Pull-Request gegen alle Schranken auf einmal.
 *
 * Meldet ausdruecklich ALLE Verstoesse, nicht nur den ersten: Sonst braucht
 * eine Routine drei Laeufe, um drei Probleme zu erfahren.
 */
export function pruefeSchranken({ dateien, geaenderteZeilen, browsertests, paketVorher, paketNachher }) {
  const probleme = [...pruefeSkripte(paketVorher, paketNachher)];

  const beruehrt = dateien.filter(istGesperrt);
  if (beruehrt.length > 0) {
    probleme.push(
      `Gesperrte Pfade beruehrt: ${beruehrt.join(', ')}. ` +
        'Eine erzeugende Routine darf ihre eigene Sicherung nicht anfassen. ' +
        'Begruendung in docs/routinen.md.',
    );
  }

  if (geaenderteZeilen > MAX_GEAENDERTE_ZEILEN) {
    probleme.push(
      `Zu gross: ${geaenderteZeilen} geaenderte Zeilen, erlaubt sind ${MAX_GEAENDERTE_ZEILEN}. ` +
        'Eine grosse Aenderung, die niemand liest, ist eine Wette. Als Issue mit Vorschlag anlegen.',
    );
  }

  if (browsertests < MINDEST_BROWSERTESTS) {
    probleme.push(
      `Zu wenige Browsertests: ${browsertests} gefunden, erwartet mindestens ${MINDEST_BROWSERTESTS}. ` +
        'e2e/ zaehlt nicht in die Abdeckung — ein weggenommener Browsertest senkt sonst keine Schwelle.',
    );
  }

  return { ok: probleme.length === 0, probleme };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tools/routine-schranken.test.mjs`
Expected: PASS, 23 Tests (10 fuer istGesperrt, 6 fuer pruefeSkripte, 7 fuer pruefeSchranken)

- [ ] **Step 5: Commit**

```bash
git add tools/routine-schranken.mjs tools/routine-schranken.test.mjs
git commit -m "test(routinen): Schranken fuer routine-Zweige als gepruefte Regeln

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Der Aufrufer

**Files:**
- Create: `tools/pruefe-routine.mjs`
- Modify: `package.json` (Skript `pruefe:routine`)

**Interfaces:**
- Consumes: `pruefeSchranken`, `MINDEST_BROWSERTESTS` aus `./routine-schranken.mjs`.
- Produces: ein ausfuehrbares Skript. Exit 0 = in Ordnung, Exit 1 = Verstoss, Meldung auf stderr.

- [ ] **Step 1: Den Aufrufer schreiben**

Erstelle `tools/pruefe-routine.mjs`:

```js
#!/usr/bin/env node
/**
 * Prueft einen `routine/*`-Zweig gegen die Schranken aus routine-schranken.mjs.
 *
 * Sammelt die Tatsachen — Diff gegen den Vergleichszweig und Anzahl der
 * Browsertests — und reicht sie an die reinen Funktionen weiter. Die Regeln
 * stehen dort und sind dort getestet; hier steht nur das Beschaffen.
 *
 * Aufruf: node tools/pruefe-routine.mjs [vergleichszweig]
 * Vorgabe fuer den Vergleichszweig: origin/main
 *
 * Exit 0 = durchlassen, Exit 1 = abweisen.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pruefeSchranken } from './routine-schranken.mjs';

const basis = process.argv[2] ?? 'origin/main';

const git = (...argumente) =>
  execFileSync('git', argumente, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Der gemeinsame Vorfahr — nicht der Zweigkopf, sonst zaehlen fremde Commits mit. */
function vergleichspunkt() {
  return git('merge-base', basis, 'HEAD').trim();
}

function geaenderteDateien(punkt) {
  return git('diff', '--name-only', punkt, 'HEAD')
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean);
}

/**
 * Summe aus hinzugefuegten und entfernten Zeilen.
 *
 * Binaerdateien meldet git mit `-` statt einer Zahl; die zaehlen als 0, sonst
 * scheitert die Pruefung an einem Bild.
 */
function geaenderteZeilen(punkt) {
  return git('diff', '--numstat', punkt, 'HEAD')
    .split('\n')
    .filter(Boolean)
    .reduce((summe, zeile) => {
      const [plus, minus] = zeile.split('\t');
      return summe + (Number(plus) || 0) + (Number(minus) || 0);
    }, 0);
}

/**
 * Zaehlt die **aktiven** Browsertests ueber `playwright test --list`.
 *
 * Zwei Fallen, beide nachgemessen:
 *
 * 1. Die Textausgabe endet mit "Total: N tests in M files". Das ist Anzeige
 *    und kein Vertrag — der JSON-Bericht ist die verlaessliche Form.
 * 2. **`--list` zaehlt uebersprungene Tests mit.** Ein `test.skip(...)` liesse
 *    die Gesamtzahl also unveraendert, waehrend der Test nichts mehr prueft —
 *    eine Schranke, die dasteht und nichts tut. Beim Auflisten meldet jeder
 *    Eintrag `status: "skipped"` (es lief ja nichts); was zaehlt, ist
 *    `expectedStatus`: bei einem stillgelegten Test steht dort `"skipped"`,
 *    sonst `"passed"`.
 *
 * Gezaehlt wird deshalb nur, was mindestens einen nicht stillgelegten Lauf
 * erwartet.
 */
function browsertests() {
  const roh = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const bericht = JSON.parse(roh);

  const specs = [];
  (function sammle(knoten) {
    for (const unter of knoten.suites ?? []) sammle(unter);
    for (const spec of knoten.specs ?? []) specs.push(spec);
  })({ suites: bericht.suites ?? [] });

  return specs.filter((spec) => (spec.tests ?? []).some((t) => t.expectedStatus !== 'skipped')).length;
}

/**
 * `package.json` in beiden Staenden, als geparste Objekte.
 *
 * Fehlt die Datei in einem der beiden Staende oder ist sie unlesbar, gibt es
 * `null` — `pruefeSkripte` meldet dann nichts, statt an einer Ausnahme zu
 * scheitern.
 */
function paketStand(quelle) {
  try {
    return JSON.parse(quelle === 'HEAD' ? readFileSync('package.json', 'utf8') : git('show', `${quelle}:package.json`));
  } catch {
    return null;
  }
}

const punkt = vergleichspunkt();
const ergebnis = pruefeSchranken({
  dateien: geaenderteDateien(punkt),
  geaenderteZeilen: geaenderteZeilen(punkt),
  browsertests: browsertests(),
  paketVorher: paketStand(punkt),
  paketNachher: paketStand('HEAD'),
});

if (ergebnis.ok) {
  console.log(`Schranken eingehalten (Vergleich gegen ${basis}).`);
  process.exit(0);
}

console.error(`Schranken verletzt (Vergleich gegen ${basis}):\n`);
for (const problem of ergebnis.probleme) console.error(`- ${problem}\n`);
console.error(
  'Diese Pruefung ist mechanisch, keine Meinung. Der Torwaechter schliesst einen\n' +
    'Pull-Request mit rotem Schranken-Auftrag, ohne ihn zu lesen.',
);
process.exit(1);
```

- [ ] **Step 2: Skript in `package.json` ergaenzen**

Unter `scripts` einfuegen:

```json
"pruefe:routine": "node tools/pruefe-routine.mjs"
```

- [ ] **Step 3: Gegen den eigenen Zweig laufen lassen**

Run: `npm run pruefe:routine -- origin/main`
Expected: Das Skript laeuft durch und meldet mindestens zwei Verstoesse — dieser
Zweig legt `tools/routine-schranken.mjs` an (gesperrter Pfad) und ergaenzt ein
Skript in `package.json`. Letzteres darf es: Hinzufuegen ist erlaubt. Gemeldet
wird also der gesperrte Pfad, nicht das Skript.

Genau so soll es sein: Der Zweig ist ja kein `routine/*`-Zweig, sondern der, der
die Schranke baut. Wichtig ist nur, dass das Skript **laeuft**, den Diff findet
und die **aktiven** Browsertests zaehlt — die Zahl muss **20** sein.

Gegenprobe dazu, die du gleich mitmachen sollst: Setz in `e2e/dunkelmodus.spec.ts`
den ersten `test(` probeweise auf `test.skip(`, lass das Skript erneut laufen —
es muss jetzt **19** melden und den Verstoss anzeigen. Danach zuruecknehmen
(`git checkout -- e2e/dunkelmodus.spec.ts`) und pruefen, dass wieder 20 gezaehlt
werden. Ohne diesen Nachweis wissen wir nicht, ob die Zaehlung ein `test.skip`
ueberhaupt bemerkt. Beide Ausgaben in den Bericht.

Notiere die Ausgabe im Bericht. Ist die gemeldete Testzahl **nicht** 20, stimmt
das Zaehlen nicht — dann nachbessern, bevor es weitergeht.

- [ ] **Step 4: Commit**

```bash
git add tools/pruefe-routine.mjs package.json
git commit -m "chore(routinen): Aufrufer fuer die Schrankenpruefung

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Der CI-Auftrag

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `npm run pruefe:routine` aus Task 2.
- Produces: einen CI-Auftrag namens `Schranken fuer Routine-Zweige`. Dieser Name
  ist spaeter der Required Status Check in der Branch Protection — er darf danach
  nicht mehr geaendert werden, ohne die Einstellung auf GitHub nachzuziehen.

- [ ] **Step 1: `forbidOnly` in die Playwright-Konfiguration**

In `playwright.config.ts` in das `defineConfig`-Objekt aufnehmen, neben `retries`:

```ts
  // Ein vergessenes test.only legt 19 von 20 Tests still, ohne dass etwas rot
  // wird. Unter CI ist das ein Fehlschlag, lokal bleibt es ein nuetzliches
  // Werkzeug.
  forbidOnly: !!process.env.CI,
```

- [ ] **Step 2: Den Auftrag in `ci.yml` ergaenzen**

Am Ende von `.github/workflows/ci.yml` anhaengen:

```yaml
  schranken:
    name: Schranken fuer Routine-Zweige
    runs-on: ubuntu-latest
    # Nur fuer Zweige, die eine Routine erzeugt hat. Fuer alles andere gelten
    # die Schranken nicht — ein Mensch darf package.json aendern.
    if: startsWith(github.head_ref, 'routine/')
    steps:
      - uses: actions/checkout@v4
        with:
          # Ohne die ganze Historie findet `git merge-base` den Vergleichspunkt
          # nicht, und der Diff waere leer — die Pruefung liefe ins Leere.
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - run: npm ci

      - name: Schranken pruefen
        run: npm run pruefe:routine -- origin/${{ github.base_ref }}
```

Zwei Dinge, die hier leicht schiefgehen:
- `fetch-depth: 0` ist zwingend. Ohne die Historie gibt `git merge-base` nichts
  zurueck, der Diff waere leer, und die Pruefung wuerde **jeden** Pull-Request
  durchwinken — eine Schranke, die stillschweigend nichts tut.
- `github.head_ref` ist nur bei `pull_request` gesetzt. Bei einem Push auf `main`
  ist es leer, `startsWith` ergibt `false`, der Auftrag laeuft nicht. Das ist
  richtig so.

- [ ] **Step 3: YAML pruefen**

Run: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML gueltig"`
Expected: `YAML gueltig`

- [ ] **Step 4: Alles lokal gruen halten**

Run: `npm test && npm run lint && npm run build && npm run test:e2e`
Expected: alles gruen; die Browsertests weiterhin 20

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml playwright.config.ts
git commit -m "ci: Schranken-Auftrag fuer routine-Zweige, forbidOnly unter CI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `docs/routinen.md`

Die Datei, auf die alle spaeteren Routinen verweisen. Sie erklaert nicht nur
**was** gilt, sondern **warum** — eine Regel ohne Grund wird beim ersten
Widerstand umgangen.

**Files:**
- Create: `docs/routinen.md`
- Modify: `CLAUDE.md` (eine Zeile in der Tabelle „Wo was steht")

**Interfaces:**
- Consumes: die Werte aus `tools/routine-schranken.mjs`.
- Produces: den Text, auf den die fuenf `SKILL.md`-Dateien des naechsten Plans verweisen.

- [ ] **Step 1: Die Datei schreiben**

Erstelle `docs/routinen.md` mit diesen Abschnitten. Schreib sie in Prosa im Stil
von `CLAUDE.md` (deutscher Fliesstext ohne Umlaute, sachlich, knapp), nicht als
Stichpunktliste:

1. **Wozu das hier gut ist.** Autonome Wartungsroutinen erzeugen
   Pull-Requests, die kein Mensch liest. Die Sicherung ist deshalb maschinell:
   Tests, die bei geaendertem Verhalten rot werden, und die Schranken hier.
2. **Der gemeinsame Rahmen** — woertlich aus der Spezifikation, Teil 2:
   Branch `routine/<name>/<JJJJ-MM-TT>`, hoechstens ein Pull-Request pro Lauf,
   nichts gefunden heisst still beenden, `npm run lint && npm test && npm run build`
   muessen lokal gruen sein bevor der Pull-Request entsteht, kein
   Verhaltenswechsel ohne einen Test der ihn zeigt, feste Form der
   Pull-Request-Beschreibung (was, warum, welcher Beweis).
3. **Die mechanischen Schranken** — mit dem Hinweis, dass sie in
   `tools/routine-schranken.mjs` stehen, dort getestet sind und von der CI
   erzwungen werden: hoechstens 400 geaenderte Zeilen, keine gesperrten Pfade,
   mindestens 20 Browsertests. Nenne die Sperrliste vollstaendig und sag bei
   jedem Eintrag in einem Halbsatz, warum er darauf steht.
4. **Warum Testdateien NICHT gesperrt sind.** Uebernimm die Begruendung aus dem
   Abschnitt „Zwei Entscheidungen" dieses Plans: Nicht „Tests sind unantastbar",
   sondern „der Beweiswert darf nicht sinken". Deshalb wird das Wegnehmen
   gezaehlt statt verboten.
5. **Die bewusste Luecke bei der Abdeckung.** Zwischen gemessenem Wert und
   Schwelle liegen zwei Punkte Spielraum. Das ist Absicht, damit eine harmlose
   Zeile die CI nicht rot faerbt — und es ist der Preis dafuer. Wer die Zahlen
   aendert, aendert eine Absprache.
6. **Was die Schranken NICHT leisten.** Der Schranken-Auftrag laeuft aus der
   Workflow-Datei des Pull-Request-Zweiges selbst. Gegen eine Aenderung an genau
   dieser Datei schuetzt er deshalb nicht — dafuer braucht es eine Branch
   Protection Rule mit Required Status Checks auf `main`, eingerichtet in den
   GitHub-Einstellungen. Ohne die ist alles hier Kosmetik.

- [ ] **Step 2: Auf die Datei verweisen**

In `CLAUDE.md` in der Tabelle „Wo was steht" eine Zeile ergaenzen:

```
| Was duerfen autonome Routinen? | `docs/routinen.md` |
```

Achte auf das Zeichenbudget: `CLAUDE.md` liegt in jeder Nachricht im Kontext,
und `tools/pruefe-schleuse.mjs` prueft die Grenze (12000 Zeichen). Eine Zeile
mehr ist unkritisch, mehr nicht.

- [ ] **Step 3: Schleuse pruefen**

Run: `node tools/pruefe-schleuse.mjs < /dev/null; echo "Exit: $?"`
Expected: `Exit: 0` (ohne Eingabe beendet die Schleuse sich still)

Zusaetzlich: `node -e "console.log(require('fs').readFileSync('CLAUDE.md','utf8').length)"`
Expected: eine Zahl unter 12000

- [ ] **Step 4: Commit**

```bash
git add docs/routinen.md CLAUDE.md
git commit -m "docs: Regeln fuer autonome Wartungsroutinen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Die Gegenprobe — sehen, dass die Schranke wirklich zuschlaegt

Der wichtigste Task des Plans. Eine Schranke, die man nur hinschreibt, ist eine
Behauptung. In diesem Projekt hat genau diese Gegenprobe schon zweimal einen
Mangel aufgedeckt, den niemand vermutet hatte.

**Files:** keine dauerhaften. Es entstehen ein Wegwerf-Zweig und ein
Wegwerf-Pull-Request, beide werden am Ende geloescht.

**Interfaces:**
- Consumes: den CI-Auftrag aus Task 3.
- Produces: den Nachweis, dass er greift.

- [ ] **Step 1: Den Zweig dieses Plans hochladen und mergen lassen**

Der Schranken-Auftrag muss auf `main` liegen, bevor man ihn gegen einen
`routine/*`-Zweig probieren kann.

```bash
git push -u origin feature/routine-schranken
gh pr create --base main --fill
gh pr checks --watch
```

**Halt hier an und frag den Nutzer, bevor du mergst.** Ein Merge nach `main`
ist eine Aktion nach aussen.

- [ ] **Step 2: Einen Zweig bauen, der jede Schranke einzeln verletzt**

Nach dem Merge, von aktuellem `main` aus:

```bash
git checkout main && git pull
git checkout -b routine/probe/$(date +%Y-%m-%d)
```

Verletze **alle drei** Schranken auf einmal, damit ein einziger Lauf alle drei
Meldungen zeigt:

```bash
# 1. Gesperrter Pfad
printf '\n' >> vitest.config.ts

# 2. Ein Browsertest weniger
sed -i "0,/^test(/s//test.skip(/" e2e/dunkelmodus.spec.ts

# 3. Zu grosser Diff
node -e "require('fs').writeFileSync('src/wegwerf-probe.ts', Array.from({length: 420}, (_, i) => 'export const probe' + i + ' = ' + i + ';').join('\n') + '\n')"

git add -A && git commit -m "test: absichtliche Verletzung aller drei Schranken

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --base main --title "WEGWERF: Gegenprobe der Schranken" --body "Absichtlich fehlerhaft. Wird nach der Pruefung geschlossen."
```

- [ ] **Step 3: Den Auftrag rot sehen — und die Meldungen lesen**

Run: `gh pr checks --watch`
Expected: Der Auftrag `Schranken fuer Routine-Zweige` ist **rot**.

Dann das Protokoll holen:

Run: `gh run view --log-failed | grep -A 3 "Gesperrte Pfade\|Zu gross\|Zu wenige"`
Expected: **alle drei** Meldungen erscheinen — gesperrter Pfad (`vitest.config.ts`),
zu gross (mehr als 400 Zeilen), zu wenige Browsertests (19 statt 20).

Erscheinen nur ein oder zwei davon, meldet `pruefeSchranken` nicht alle
Verstoesse zusammen — dann nachbessern. Erscheint gar keine, hat der Auftrag
nicht gegriffen: Pruefe, ob `if: startsWith(github.head_ref, 'routine/')`
zutrifft und ob `fetch-depth: 0` gesetzt ist.

- [ ] **Step 4: Die Gegenprobe der Gegenprobe**

Ein roter Lauf allein beweist nur, dass etwas rot wird. Zeig auch, dass der
Auftrag einen **sauberen** Routine-Zweig durchlaesst:

```bash
git checkout -b routine/probe-sauber/$(date +%Y-%m-%d) main
# Eine kleine, erlaubte Aenderung an einer nicht gesperrten Datei:
printf '\n' >> README.md
git add README.md && git commit -m "test: harmlose Aenderung fuer die Gegenprobe

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --base main --title "WEGWERF: sauberer Routine-Zweig" --body "Muss durchgehen."
gh pr checks --watch
```

Expected: Der Auftrag `Schranken fuer Routine-Zweige` ist **gruen**.

Das ist die Haelfte, die man gern vergisst: Eine Schranke, die alles abweist,
ist genauso kaputt wie eine, die alles durchlaesst — nur faellt es spaeter auf,
naemlich wenn nie ein Pull-Request durchkommt und keiner weiss warum.

- [ ] **Step 5: Aufraeumen**

```bash
gh pr close <nummer-der-fehlerhaften> --delete-branch
gh pr close <nummer-der-sauberen> --delete-branch
git checkout main && git pull
git branch -D routine/probe/$(date +%Y-%m-%d) routine/probe-sauber/$(date +%Y-%m-%d)
git branch -d feature/routine-schranken
```

Pruefe danach mit `git branch -a`, dass keine Wegwerf-Zweige uebrig sind, und
mit `git status`, dass `src/wegwerf-probe.ts` nicht im Arbeitsbaum steht.

- [ ] **Step 6: Beide Protokolle im Bericht festhalten**

Schreib die Ausgabe des roten und des gruenen Laufs woertlich auf. Ohne diesen
Nachweis wissen wir nur, dass die Schranke dasteht — nicht, dass sie hinsieht.

---

## Danach

Was dieser Plan **nicht** enthaelt und was als naechstes ansteht:

1. **Branch Protection auf `main`** mit `Schranken fuer Routine-Zweige`,
   `Typen, Tests, Build` und `Durchspiel im Browser` als Required Status Checks.
   Das ist eine Handlung des Nutzers in den GitHub-Einstellungen und kann nicht
   im Repository erledigt werden. Sie muss stehen, bevor irgendetwas
   Merge-Rechte bekommt.
2. **Die fuenf `SKILL.md`-Dateien** unter `~/.claude/scheduled-tasks/` — vier
   erzeugende Routinen und der Torwaechter. Eigener Plan, geschrieben erst wenn
   `docs/routinen.md` wirklich dasteht: Ein Prompt, der auf einen Text verweist,
   den man sich beim Schreiben noch ausdenkt, ist eine Vermutung.
3. **Offen geblieben** aus der Spezifikation: ob `knip` oder `ts-prune` die
   bessere Grundlage fuer die Routine „Toter Code" ist, und ob der Torwaechter
   eine Routine nach drei verworfenen Pull-Requests in Folge selbst stilllegt.
   Beides gehoert in den Plan der Routinen, nicht hierher.
