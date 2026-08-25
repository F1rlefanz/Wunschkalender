import type { Role } from './types';

/**
 * Zeitzone der Station. Der Stichtag ist ein Kalendertag, kein Zeitpunkt —
 * ohne feste Zone kippte die Sperre auf einem Server mit anderer Zeit um
 * Stunden versetzt zur Ortszeit.
 */
export const STATIONS_ZEITZONE = 'Europe/Berlin';

/**
 * Vorlauf des automatischen Vorschlags in Tagen: acht Wochen. Der Wunschplan
 * einer Station liegt Wochen im Voraus aus — der November wird Ende August
 * geschrieben, nicht Ende Oktober.
 */
export const VORGABE_VORLAUF_TAGE = 56;

/** Woher der wirksame Stichtag eines Monats stammt. */
export type Herkunft = 'gesetzt' | 'automatisch';

export interface SperrfristEingabe {
  /** Der Monat, um den es geht, als `YYYY-MM`. */
  monat: string;
  /** Vorlauf des automatischen Vorschlags in Tagen. Vorgabe: acht Wochen. */
  vorlaufTage?: number;
  /** Ausdruecklich gesetzte Stichtage, `YYYY-MM` auf `YYYY-MM-DD`. */
  stichtage?: Record<string, string>;
  /** Rolle der anfragenden Person. Die Leitung plant und ist ausgenommen. */
  rolle: Role;
  /** Zeitpunkt, gegen den geprueft wird. Vorgabe: jetzt. */
  jetzt?: Date;
}

export interface Sperrfrist {
  /** Der gepruefte Monat, wie hereingereicht. */
  monat: string;
  /** Letzter Tag, an dem eingetragen werden darf; `null` bei unlesbarem Monat. */
  stichtag: string | null;
  herkunft: Herkunft;
  /**
   * Ob der Stichtag verstrichen ist — unabhaengig von der Rolle. Die Leitung
   * muss lesen koennen, was fuer die Mitarbeitenden gilt, ohne selbst gesperrt
   * zu sein.
   */
  abgelaufen: boolean;
  /** Ob die anfragende Person in diesem Monat nichts mehr aendern darf. */
  gesperrt: boolean;
}

/** Kalenderfelder eines Zeitpunkts in der Stationszeitzone. */
function heuteInStationszeit(jetzt: Date = new Date()): {
  jahr: number;
  monat: number;
  tag: number;
} {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: STATIONS_ZEITZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(jetzt);

  const wert = (typ: string) => Number(teile.find((t) => t.type === typ)!.value);
  return { jahr: wert('year'), monat: wert('month'), tag: wert('day') };
}

/** Der heutige Kalendertag der Station als `YYYY-MM-DD`. */
export function heutigerTag(jetzt?: Date): string {
  const heute = heuteInStationszeit(jetzt);
  return alsDatum(heute.jahr, heute.monat, heute.tag);
}

function zweistellig(zahl: number): string {
  return String(zahl).padStart(2, '0');
}

function alsDatum(jahr: number, monat: number, tag: number): string {
  return `${String(jahr).padStart(4, '0')}-${zweistellig(monat)}-${zweistellig(tag)}`;
}

function zerlegeMonat(monat: string): { jahr: number; monat: number } | null {
  const treffer = /^(\d{4})-(\d{2})$/.exec(monat);
  if (!treffer) return null;
  const zahl = Number(treffer[2]);
  if (zahl < 1 || zahl > 12) return null;
  return { jahr: Number(treffer[1]), monat: zahl };
}

function istDatum(wert: unknown): wert is string {
  return typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert);
}

/**
 * Verschiebt einen Kalendertag um eine Anzahl Tage.
 *
 * Gerechnet wird in UTC, weil hier nur Kalenderfelder zaehlen und keine
 * Ortszeit — die kommt aus `heuteInStationszeit`. `Date.UTC` normalisiert
 * Ueberlaeufe von selbst, damit sind Monatslaengen, Jahreswechsel und
 * Schaltjahre keine Sonderbehandlung.
 */
function verschiebeTage(datum: string, tage: number): string {
  const [jahr, monat, tag] = datum.split('-').map(Number);
  const verschoben = new Date(Date.UTC(jahr, monat - 1, tag + tage));
  return alsDatum(
    verschoben.getUTCFullYear(),
    verschoben.getUTCMonth() + 1,
    verschoben.getUTCDate(),
  );
}

/** Der Monat eines Datums `YYYY-MM-DD` als `YYYY-MM`. */
export function monatVon(datum: string): string {
  return datum.slice(0, 7);
}

/**
 * Der automatische Vorschlag: der erste Tag des Monats, um den Vorlauf
 * zurueckgerechnet. Der November beginnt am 01.11.; acht Wochen davor ist der
 * 06.09. — bis dahin darf eingetragen werden.
 */
export function automatischerStichtag(monat: string, vorlaufTage = VORGABE_VORLAUF_TAGE): string | null {
  const ziel = zerlegeMonat(monat);
  if (!ziel) return null;
  const vorlauf = Number.isInteger(vorlaufTage) && vorlaufTage >= 0 ? vorlaufTage : VORGABE_VORLAUF_TAGE;
  return verschiebeTage(alsDatum(ziel.jahr, ziel.monat, 1), -vorlauf);
}

/**
 * Ermittelt den wirksamen Stichtag eines Monats und ob er verstrichen ist.
 *
 * - Ein ausdruecklich gesetzter Stichtag gilt und wird vom Vorschlag **nie**
 *   ueberschrieben, auch nicht, wenn sich der Vorlauf spaeter aendert. Der
 *   Vorschlag ist eine Rueckfallebene, keine laufende Korrektur.
 * - Sonst gilt der automatische Vorschlag: Monatsanfang minus Vorlauf.
 * - Offen ist ein Monat **bis einschliesslich** seinem Stichtag. "Wuensche
 *   eintragen bis 06.09." heisst auf der Station, dass der 06.09. mitzaehlt.
 * - Dass der laufende Monat und alles davor gesperrt sind, folgt daraus von
 *   selbst: Deren Stichtag liegt immer Wochen in der Vergangenheit.
 * - Die Leitung ist nie gesperrt; sie plant. Den Stichtag bekommt sie trotzdem
 *   genannt — sonst kann sie den Termin nicht ankuendigen.
 * - Ein unlesbarer Monat wird gesperrt, nicht durchgelassen: Im Zweifel lieber
 *   eine Eintragung zu viel ablehnen als eine Sperre stillschweigend umgehen.
 */
export function sperrfristFuerMonat({
  monat,
  vorlaufTage,
  stichtage,
  rolle,
  jetzt,
}: SperrfristEingabe): Sperrfrist {
  const gesetzt = stichtage?.[monat];
  const vorschlag = automatischerStichtag(monat, vorlaufTage);

  const stichtag = istDatum(gesetzt) ? gesetzt : vorschlag;
  const herkunft: Herkunft = istDatum(gesetzt) ? 'gesetzt' : 'automatisch';
  // Zeichenketten in `YYYY-MM-DD` vergleichen sich richtig, weil die Felder
  // von gross nach klein stehen und feste Breite haben.
  const abgelaufen = stichtag === null || heutigerTag(jetzt) > stichtag;

  return {
    monat,
    stichtag,
    herkunft,
    abgelaufen,
    gesperrt: rolle === 'Manager' ? false : abgelaufen,
  };
}

/** Kurzform derselben Entscheidung fuer alle, die nur das Ja/Nein brauchen. */
export function istMonatGesperrt(eingabe: SperrfristEingabe): boolean {
  return sperrfristFuerMonat(eingabe).gesperrt;
}

/**
 * Was ueber dem Monat steht. Die Anwendung ist ein Kommunikationsmittel: Der
 * Termin gehoert sichtbar in den Monatskopf, nicht in einen Zettel am
 * schwarzen Brett.
 */
export function stichtagSatz(frist: Sperrfrist): string {
  if (!frist.stichtag) return '';
  if (!frist.abgelaufen) return `Wünsche bis ${kurzesDatum(frist.stichtag)}`;
  // Nicht "seit dem Stichtag": An diesem Tag war noch offen. Geschlossen ist
  // seit dem Tag danach.
  return `Geschlossen seit ${kurzesDatum(verschiebeTage(frist.stichtag, 1))}`;
}

/** `2026-09-06` als `06.09.` — Jahr und Monat stehen daneben in der Ueberschrift. */
export function kurzesDatum(datum: string): string {
  const [, monat, tag] = datum.split('-');
  return `${tag}.${monat}.`;
}
