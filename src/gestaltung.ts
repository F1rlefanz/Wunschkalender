/**
 * Die Gestaltungsgrundlage nachrechenbar machen (#21).
 *
 * Farbwerte stehen genau einmal, naemlich in `src/index.css`. Diese Datei
 * liest sie von dort und rechnet Kontraste aus, damit `gestaltung.test.ts`
 * pruefen kann statt zu schaetzen. Die Werte hier zu wiederholen waere eine
 * zweite Wahrheit — und die faellt frueher oder spaeter auseinander.
 */

/** Farbrolle -> Hexwert, je einmal fuer hell und fuer dunkel. */
export type Palette = Record<string, string>;

export interface Paletten {
  hell: Palette;
  dunkel: Palette;
}

const DUNKEL_MARKE = '@media (prefers-color-scheme: dark)';

/**
 * Zieht die `--haus-*`-Rollen aus dem Stylesheet.
 *
 * Alles vor der Dunkelmodus-Abfrage ist die helle Palette, alles danach die
 * dunkle. Das ist genau die Reihenfolge, in der `index.css` sie deklariert;
 * wer sie dort umstellt, muss auch hier hinsehen.
 */
export function lesePaletten(css: string): Paletten {
  const schnitt = css.indexOf(DUNKEL_MARKE);
  if (schnitt === -1) {
    throw new Error(`Kein Block "${DUNKEL_MARKE}" in der Stilvorlage gefunden.`);
  }
  return {
    hell: leseRollen(css.slice(0, schnitt)),
    dunkel: leseRollen(css.slice(schnitt)),
  };
}

function leseRollen(abschnitt: string): Palette {
  const rollen: Palette = {};
  const muster = /--haus-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(abschnitt)) !== null) {
    rollen[treffer[1]] = treffer[2].toLowerCase();
  }
  return rollen;
}

/** Relative Leuchtdichte nach WCAG 2.1. */
export function leuchtdichte(hex: string): number {
  const kanaele = [1, 3, 5].map((start) => {
    const roh = parseInt(hex.slice(start, start + 2), 16) / 255;
    return roh <= 0.03928 ? roh / 12.92 : Math.pow((roh + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * kanaele[0] + 0.7152 * kanaele[1] + 0.0722 * kanaele[2];
}

/** Kontrastverhaeltnis zweier Farben, zwischen 1 und 21. */
export function kontrast(vorne: string, hinten: string): number {
  const a = leuchtdichte(vorne);
  const b = leuchtdichte(hinten);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface Paarung {
  vorne: string;
  hinten: string;
  /** Wofuer die Kombination gedacht ist — steht im Fehlertext des Tests. */
  zweck: string;
}

/**
 * Kombinationen, die in der Oberflaeche tatsaechlich vorkommen duerfen.
 *
 * Was hier nicht steht, ist nicht verboten — aber ungeprueft. Wer eine neue
 * Kombination in einer Komponente benutzt, traegt sie hier nach.
 */
export const TEXTPAARE: Paarung[] = [
  { vorne: 'text', hinten: 'hintergrund', zweck: 'Fliesstext auf der Seite' },
  { vorne: 'text', hinten: 'flaeche', zweck: 'Fliesstext auf einer Karte' },
  { vorne: 'text', hinten: 'flaeche-leise', zweck: 'Fliesstext auf abgesetzter Flaeche' },
  { vorne: 'text-leise', hinten: 'hintergrund', zweck: 'Nebentext auf der Seite' },
  { vorne: 'text-leise', hinten: 'flaeche', zweck: 'Nebentext auf einer Karte' },
  { vorne: 'text-leise', hinten: 'flaeche-leise', zweck: 'Nebentext auf abgesetzter Flaeche' },
  { vorne: 'marke-kontrast', hinten: 'marke', zweck: 'Beschriftung auf dem Hauptknopf' },
  { vorne: 'marke', hinten: 'flaeche', zweck: 'Markenfarbener Text auf einer Karte' },
  { vorne: 'marke-kontrast', hinten: 'marke-tief', zweck: 'Hauptknopf unter dem Zeiger' },
  { vorne: 'marke-leise-text', hinten: 'marke-leise', zweck: 'Text in einem Marken-Chip' },
  { vorne: 'fehler-kontrast', hinten: 'fehler', zweck: 'Beschriftung auf einem Fehlerknopf' },
  { vorne: 'fehler-leise-text', hinten: 'fehler-leise', zweck: 'Text in einer Fehlermeldung' },
  // Auf der roten Kopfzeile gibt es **nur** Weiss: Jeder gedaempfte Ton faellt
  // dort durch (CD-Hellrot #FBE1E4 erreicht 4.0:1). Deshalb steht hier nur ein
  // Textpaar — die Rangfolge macht das Schriftgewicht.
  { vorne: 'kopf-text', hinten: 'kopf', zweck: 'Beschriftung in der Kopfzeile' },
  { vorne: 'kopf', hinten: 'kopf-text', zweck: 'Umgekehrter Knopf unter dem Zeiger' },
  { vorne: 'leiste-text', hinten: 'leiste', zweck: 'Beschriftung der Auswahlleiste' },
  { vorne: 'leiste-leise', hinten: 'leiste', zweck: 'Nebentext der Auswahlleiste' },
  { vorne: 'leiste-text', hinten: 'leiste-aktiv', zweck: 'Auswahlleiste unter dem Zeiger' },
  { vorne: 'frueh-text', hinten: 'frueh', zweck: 'Kennzeichnung der Fruehschicht' },
  { vorne: 'spaet-text', hinten: 'spaet', zweck: 'Kennzeichnung der Spaetschicht' },
  { vorne: 'nacht-text', hinten: 'nacht', zweck: 'Kennzeichnung der Nachtschicht' },
  { vorne: 'frei-text', hinten: 'frei', zweck: 'Kennzeichnung von Frei' },
];

/**
 * Kombinationen, die keine Schrift tragen: Rahmen, Symbole, Fokusring.
 * Fuer sie verlangt WCAG 1.4.11 nur 3:1.
 *
 * Bewusst nicht enthalten: die Hinterlegung des aktiven Weges in der
 * Kopfzeile — es gibt keine. Dass ein Weg der aktuelle ist, sagen
 * `aria-current`, das Schriftgewicht und ein weisser Unterstrich.
 */
export const FLAECHENPAARE: Paarung[] = [
  { vorne: 'rand-stark', hinten: 'flaeche', zweck: 'Rahmen eines Eingabefelds' },
  { vorne: 'rand-stark', hinten: 'hintergrund', zweck: 'Rahmen auf der Seite' },
  { vorne: 'marke', hinten: 'flaeche', zweck: 'Markenflaeche auf einer Karte' },
  { vorne: 'marke', hinten: 'hintergrund', zweck: 'Markenflaeche auf der Seite' },
  { vorne: 'fehler', hinten: 'flaeche', zweck: 'Fehlersymbol auf einer Karte' },
  { vorne: 'fehler', hinten: 'hintergrund', zweck: 'Fehlersymbol auf der Seite' },
  { vorne: 'fokus', hinten: 'hintergrund', zweck: 'Fokusring auf der Seite' },
  { vorne: 'fokus', hinten: 'flaeche', zweck: 'Fokusring auf einer Karte' },
  { vorne: 'kopf-text', hinten: 'kopf', zweck: 'Umriss eines Knopfes in der Kopfzeile' },
  { vorne: 'kopf-fokus', hinten: 'kopf', zweck: 'Fokusring in der Kopfzeile' },
  { vorne: 'leiste-fokus', hinten: 'leiste', zweck: 'Fokusring in der Auswahlleiste' },
  { vorne: 'leiste-text', hinten: 'leiste', zweck: 'Umriss des Hauptknopfes in der Leiste' },
  { vorne: 'frueh-text', hinten: 'flaeche', zweck: 'Punkt der Fruehschicht im Raster' },
  { vorne: 'spaet-text', hinten: 'flaeche', zweck: 'Punkt der Spaetschicht im Raster' },
  { vorne: 'nacht-text', hinten: 'flaeche', zweck: 'Punkt der Nachtschicht im Raster' },
  { vorne: 'frei-text', hinten: 'flaeche', zweck: 'Punkt fuer Frei im Raster' },
];
