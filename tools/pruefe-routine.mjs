#!/usr/bin/env node
/**
 * Prueft einen `routine/*`-Zweig gegen die Schranken aus routine-schranken.mjs.
 *
 * Sammelt die Tatsachen — Diff gegen den Vergleichszweig und Anzahl der
 * Browsertests — und reicht sie an die reinen Funktionen weiter. Die Regeln
 * stehen dort und sind dort getestet; hier steht nur das Beschaffen.
 *
 * Aufruf: node tools/pruefe-routine.mjs [vergleichszweig] [zweigname]
 * Vorgabe fuer den Vergleichszweig: origin/main
 * Vorgabe fuer den Zweignamen: leer (dann: kein Routine-Zweig)
 *
 * Laeuft der Zweigname nicht auf `istRoutineZweig(...)` zu (etwa bei einem
 * Push auf `main`, wo `head_ref` leer ist, oder einem Zweig, den keine
 * Routine erzeugt hat), gelten die Schranken nicht — Exit 0 ohne weitere
 * Pruefung. Das ist Absicht: Der CI-Auftrag laeuft dadurch bei JEDEM
 * Pull-Request und wird nie `skipped`, siehe docs/routinen.md.
 *
 * Exit 0 = durchlassen, Exit 1 = abweisen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { istRoutineZweig, pruefeSchranken } from './routine-schranken.mjs';

const basis = process.argv[2] ?? 'origin/main';
const zweigname = process.argv[3] ?? '';

// Fehlt der Zweigname ausgerechnet bei einem echten Pull-Request, ist das ein
// Fehler in der CI-Konfiguration (etwa eine verlorene Zeile in ci.yml), kein
// harmloses "kein Routine-Zweig" — sonst haengt die ganze Schranke lautlos
// daran, dass `${{ github.head_ref }}` weiterhin ankommt.
if (process.env.GITHUB_EVENT_NAME === 'pull_request' && zweigname.trim() === '') {
  console.error('GITHUB_EVENT_NAME ist "pull_request", aber der Zweigname fehlt. Das ist ein Fehler in der CI-Konfiguration, kein "kein Routine-Zweig".');
  process.exit(1);
}

if (!istRoutineZweig(zweigname)) {
  console.log(`Kein Routine-Zweig ("${zweigname}"), Schranken gelten nicht.`);
  process.exit(0);
}

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
 * Anders als eine fehlende Datei ist ein unlesbares `package.json` (kaputtes
 * JSON, ein `git show`, das fehlschlaegt) kein harmloser Fall — das darf
 * nicht still als "nichts zu melden" durchgehen. Deshalb wird hier laut
 * abgebrochen statt `null` zurueckzugeben, an das `pruefeSkripte` sich mit
 * "nichts zu melden" haelt.
 */
function paketStand(quelle) {
  try {
    return JSON.parse(quelle === 'HEAD' ? readFileSync('package.json', 'utf8') : git('show', `${quelle}:package.json`));
  } catch (fehler) {
    console.error(`package.json bei ${quelle} nicht lesbar: ${fehler.message}`);
    process.exit(1);
  }
}

/** Zaehlt die Vorkommen von `expect(` in einem Dateiinhalt. */
function zaehleZusicherungen(inhalt) {
  return (inhalt.match(/expect\(/g) ?? []).length;
}

/** Existiert `pfad` bei Commit `punkt`? Reiner Existenz-Check, kein Inhalt. */
function existiertBeiCommit(punkt, pfad) {
  try {
    execFileSync('git', ['cat-file', '-e', `${punkt}:${pfad}`], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Zusicherungen je e2e-Datei, vorher und nachher.
 *
 * Nur Dateien, die im Diff auftauchen. "Existiert die Datei nicht" ist die
 * EINZIGE Bedingung, unter der eine Seite als 0 zaehlt (neu angelegt bzw.
 * geloescht — eine geloeschte Datei faengt ohnehin schon die Mindestzahl an
 * Browsertests ab). Existiert die Datei, aber ihr Inhalt laesst sich aus
 * einem anderen Grund nicht lesen (kaputtes `git show`, ein Dateisystemfehler),
 * wird NICHT stillschweigend 0 angenommen — das waere dieselbe permissive
 * Luecke, die paketStand oben schon vermeidet. Stattdessen bricht der Fehler
 * ungefangen durch und beendet den Prozess laut.
 */
function e2eZusicherungen(punkt, dateien) {
  return dateien
    .filter((pfad) => pfad.startsWith('e2e/'))
    .map((pfad) => {
      const vorher = existiertBeiCommit(punkt, pfad) ? zaehleZusicherungen(git('show', `${punkt}:${pfad}`)) : 0;
      const nachher = existsSync(pfad) ? zaehleZusicherungen(readFileSync(pfad, 'utf8')) : 0;
      return { pfad, vorher, nachher };
    });
}

/** Der Diff, beschraenkt auf e2e/**, fuer die Abschaltungspruefung. */
function e2eDiffText(punkt) {
  return git('diff', punkt, 'HEAD', '--', 'e2e/');
}

const punkt = vergleichspunkt();
const dateien = geaenderteDateien(punkt);
const ergebnis = pruefeSchranken({
  dateien,
  geaenderteZeilen: geaenderteZeilen(punkt),
  browsertests: browsertests(),
  paketVorher: paketStand(punkt),
  paketNachher: paketStand('HEAD'),
  e2eZusicherungen: e2eZusicherungen(punkt, dateien),
  e2eDiffText: e2eDiffText(punkt),
});

if (ergebnis.ok) {
  console.log(`Schranken eingehalten (Vergleich gegen ${basis}, Zweig "${zweigname}").`);
  process.exit(0);
}

console.error(`Schranken verletzt (Vergleich gegen ${basis}, Zweig "${zweigname}"):\n`);
for (const problem of ergebnis.probleme) console.error(`- ${problem}\n`);
console.error(
  'Diese Pruefung ist mechanisch, keine Meinung. Der Torwaechter schliesst einen\n' +
    'Pull-Request mit rotem Schranken-Auftrag, ohne ihn zu lesen.',
);
process.exit(1);
