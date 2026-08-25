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
