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
 * Die vier Werkzeuge, deren Fassung in `devDependencies` nicht sinken darf.
 *
 * Wer eines dieser Werkzeuge auf eine aeltere Fassung setzt, kann damit
 * genau die Schwellen wirkungslos machen, die dieses Skript selbst benutzt.
 */
export const GEPRUEFTE_WERKZEUGE = ['vitest', '@vitest/coverage-v8', '@playwright/test', 'typescript'];

/**
 * Was keine erzeugende Routine anfassen darf.
 *
 * Ein Eintrag mit `/` am Ende ist ein Verzeichnis-Praefix, alles andere ein
 * genauer Pfad. Testdateien stehen bewusst NICHT darauf — siehe docs/routinen.md.
 */
export const GESPERRTE_PFADE = [
  // Die Sicherungen selbst.
  '.github/',
  '.claude/',
  // Ganzes Verzeichnis statt einzelner Dateien: ein neues Werkzeug in tools/
  // (etwa ein spaeterer SessionStart-Hook) waere sonst ungeschuetzt, obwohl es
  // auf dem Rechner des Betreibers laeuft.
  'tools/',
  'docs/routinen.md',
  // Liegt in jeder Nachricht im Kontext jedes Claude, einschliesslich des
  // Torwaechters, der den Pull-Request gegenliest. Eine Routine, die diese
  // Datei "aufraeumt", schreibt an ihren eigenen Pruefer.
  'CLAUDE.md',
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
  // Traegt requireAuth/requireManager und ihre Zuordnung zu den Endpunkten —
  // der teuerste Fallstrick, den CLAUDE.md selbst benennt.
  'src/server/app.ts',
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
 * Ist `name` ein Zweig, den eine Routine erzeugt hat?
 *
 * Ohne Ruecksicht auf Gross- und Kleinschreibung, wie GitHub selbst Zweignamen
 * vergleicht. Ein leerer oder fehlender Name (etwa bei einem Push auf `main`,
 * wo es keinen `head_ref` gibt) gilt als "kein Routine-Zweig", nicht als Fehler.
 */
export function istRoutineZweig(name) {
  if (!name) return false;
  const trimmed = String(name).trim();
  if (trimmed === '') return false;
  return /^routine\/.+/i.test(trimmed);
}

/** Zieht die fuehrenden Zahlen einer Versionsangabe (`^3.2.4` -> [3, 2, 4]). */
function zerlegeFassung(angabe) {
  const treffer = String(angabe ?? '').match(/\d+/g);
  return treffer ? treffer.map(Number) : [];
}

/**
 * Ist `nachher` eine niedrigere Fassung als `vorher`?
 *
 * Ein Vergleich der fuehrenden Zahlen genuegt (`^3.2.4` -> `^3.3.0` ist in
 * Ordnung, `^3.2.4` -> `^2.9.0` nicht). Fehlt der Eintrag nachher, wo er
 * vorher da war, zaehlt das als Sinken — das Werkzeug ist dann ja weg. Fehlt
 * er vorher und kommt nachher hinzu, ist das kein Sinken.
 */
export function fassungSinkt(vorher, nachher) {
  if (vorher === undefined) return false;
  if (nachher === undefined) return true;
  const v = zerlegeFassung(vorher);
  const n = zerlegeFassung(nachher);
  const laenge = Math.max(v.length, n.length);
  for (let i = 0; i < laenge; i += 1) {
    const a = v[i] ?? 0;
    const b = n[i] ?? 0;
    if (b > a) return false;
    if (b < a) return true;
  }
  return false;
}

/** Lifecycle-Skripte, die npm ohne Zutun ausfuehrt — siehe pruefeSkripte. */
const LIFECYCLE_SKRIPTE = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack', 'postpack'];

/**
 * Vergleicht die Teile von `package.json`, die das Testnetz tragen.
 *
 * `package.json` steht nicht auf der Sperrliste, weil die Routine
 * "Abhaengigkeiten" genau diese Datei aendern muss. Geschuetzt werden deshalb
 * gezielt mehrere Stellen:
 *
 * - **`scripts`** — `test`, `test:coverage`, `test:e2e` und `lint` umzubiegen
 *   waere der Zweizeiler, der jede Pruefung ins Leere laufen laesst, ohne dass
 *   ein einziger Test angefasst wird. Hinzufuegen ist erlaubt, Aendern und
 *   Entfernen nicht.
 * - **Neue Lifecycle-Skripte** (`postinstall` und Verwandte) — `npm ci` fuehrt
 *   sie ohne Zutun aus, noch bevor irgendeine Pruefung laeuft, und kann damit
 *   den Arbeitsbaum umschreiben, bevor der Diff etwas davon sieht.
 * - **`engines`** — die Node-Untergrenze abzusenken bringt die CI zum harten
 *   Absturz statt zu einem lesbaren Fehlschlag. Genau so war sie in diesem
 *   Projekt schon einmal tagelang unbemerkt rot.
 * - **`overrides`/`resolutions`** — ein neu eingefuegtes Feld kann dieselben
 *   Werkzeuge betreffen wie die Fassungspruefung unten, nur unauffaelliger.
 * - **Die Fassungen der Pruefwerkzeuge** (`GEPRUEFTE_WERKZEUGE`) duerfen nicht
 *   sinken — sonst bestimmt die Routine selbst, mit welchem Werkzeug sie
 *   geprueft wird.
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

  for (const name of LIFECYCLE_SKRIPTE) {
    const warVorher = (vorher.scripts ?? {})[name] !== undefined;
    const istNachher = (nachher.scripts ?? {})[name] !== undefined;
    if (!warVorher && istNachher) {
      probleme.push(`Neues Lifecycle-Skript "${name}". npm fuehrt es bei "npm ci" ohne Zutun aus, noch bevor eine Pruefung laeuft.`);
    }
  }

  const vorherNode = (vorher.engines ?? {}).node;
  const nachherNode = (nachher.engines ?? {}).node;
  if (vorherNode !== nachherNode) {
    probleme.push(`Die Node-Anforderung in "engines" wurde geaendert (war: ${vorherNode}, jetzt: ${nachherNode}). Eine zu niedrige Untergrenze laesst die CI abstuerzen statt lesbar scheitern.`);
  }

  for (const feld of ['overrides', 'resolutions']) {
    if (vorher[feld] === undefined && nachher[feld] !== undefined) {
      probleme.push(`Neues Feld "${feld}" in package.json. Darueber liesse sich die Fassung eines Pruefwerkzeugs unauffaellig erzwingen.`);
    }
  }

  for (const werkzeug of GEPRUEFTE_WERKZEUGE) {
    const vorherFassung = (vorher.devDependencies ?? {})[werkzeug];
    const nachherFassung = (nachher.devDependencies ?? {})[werkzeug];
    if (fassungSinkt(vorherFassung, nachherFassung)) {
      probleme.push(
        `Die Fassung von "${werkzeug}" sinkt (war: ${vorherFassung ?? '(fehlt)'}, jetzt: ${nachherFassung ?? '(fehlt)'}). ` +
          'Damit liessen sich die Schwellen unterlaufen, die dieses Werkzeug durchsetzt.',
      );
    }
  }

  return probleme;
}

/**
 * Punkt 4a: Die Zahl der Zusicherungen (`expect(`) je Browsertestdatei darf
 * nicht sinken — sonst laesst sich eine Zusicherung entfernen, ohne dass die
 * Mindestzahl an Tests (MINDEST_BROWSERTESTS) das bemerkt.
 *
 * `eintraege` ist eine Liste aus `{ pfad, vorher, nachher }`, je betroffener
 * Datei unter `e2e/**`.
 */
export function pruefeE2eZusicherungen(eintraege) {
  const probleme = [];
  for (const { pfad, vorher, nachher } of eintraege ?? []) {
    if (nachher < vorher) {
      probleme.push(
        `Weniger Zusicherungen in ${pfad}: vorher ${vorher}, jetzt ${nachher}. ` +
          'Ein Browsertest, der weniger prueft, ist Beweiswert, der leise verschwindet.',
      );
    }
  }
  return probleme;
}

/**
 * Punkt 4b: `src/components/**` und `e2e/**` nicht im selben Pull-Request.
 *
 * Wer eine Komponente umbaut und im selben Zug die Tests nachzieht, die sie
 * bewachen, kann die Bewachung aufheben, ohne dass eine der anderen Schranken
 * das sieht. So eine Aenderung braucht einen Menschen.
 */
export function pruefeKomponentenUndE2eGetrennt(dateien) {
  const komponenten = (dateien ?? []).some((pfad) => normalisiere(pfad).startsWith('src/components/'));
  const e2e = (dateien ?? []).some((pfad) => normalisiere(pfad).startsWith('e2e/'));
  if (komponenten && e2e) {
    return [
      'Der Pull-Request fasst gleichzeitig src/components/** und e2e/** an. ' +
        'Eine Komponente und die Browsertests, die sie bewachen, gehoeren nicht in denselben Routine-Pull-Request.',
    ];
  }
  return [];
}

/**
 * Punkt 4c: Neue Laufzeit-Abschaltungen in `e2e/**` sind verboten.
 *
 * `diffText` ist ein unified diff, beschraenkt auf Dateien unter `e2e/**`.
 * Gesucht wird nach hinzugefuegten Zeilen (`+`, nicht `+++`) mit
 * `test.skip(`, `test.fixme(` oder `test.fail(`. Grund: Ein `test.skip(...)`
 * im Testkoerper meldet beim Auflisten weiterhin `expectedStatus: "passed"`
 * und wird von der Mindestzahl (MINDEST_BROWSERTESTS) mitgezaehlt, waehrend
 * der Test in der CI nichts prueft.
 */
export function pruefeE2eAbschaltungen(diffText) {
  const muster = /\btest\.(skip|fixme|fail)\s*\(/;
  const gefunden = new Set();
  for (const zeile of String(diffText ?? '').split('\n')) {
    if (!zeile.startsWith('+') || zeile.startsWith('+++')) continue;
    const treffer = zeile.match(muster);
    if (treffer) gefunden.add(treffer[1]);
  }
  if (gefunden.size === 0) return [];
  const namen = [...gefunden].sort().map((art) => `test.${art}(`);
  return [
    `Neue Laufzeit-Abschaltung(en) in e2e/**: ${namen.join(', ')}. ` +
      'Ein stillgelegter Browsertest zaehlt bei "playwright test --list" weiterhin mit, prueft aber nichts mehr.',
  ];
}

/**
 * Prueft einen Pull-Request gegen alle Schranken auf einmal.
 *
 * Meldet ausdruecklich ALLE Verstoesse, nicht nur den ersten: Sonst braucht
 * eine Routine drei Laeufe, um drei Probleme zu erfahren.
 */
export function pruefeSchranken({
  dateien,
  geaenderteZeilen,
  browsertests,
  paketVorher,
  paketNachher,
  e2eZusicherungen = [],
  e2eDiffText = '',
}) {
  const probleme = [
    ...pruefeSkripte(paketVorher, paketNachher),
    ...pruefeE2eZusicherungen(e2eZusicherungen),
    ...pruefeKomponentenUndE2eGetrennt(dateien),
    ...pruefeE2eAbschaltungen(e2eDiffText),
  ];

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
