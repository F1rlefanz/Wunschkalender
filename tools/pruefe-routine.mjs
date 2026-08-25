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
