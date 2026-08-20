import type { Role } from './types';

/**
 * Zeitzone der Station. Der Stichtag ist ein Kalendertag, kein Zeitpunkt —
 * ohne feste Zone kippte die Sperre auf einem Server mit anderer Zeit um
 * Stunden versetzt zur Ortszeit.
 */
export const STATIONS_ZEITZONE = 'Europe/Berlin';

export interface SperrfristEingabe {
  /** Der Monat, um den es geht, als `YYYY-MM`. */
  monat: string;
  /** Tag des Monats, ab dem der Folgemonat schliesst. */
  stichtag: number;
  /** Rolle der anfragenden Person. Die Leitung plant und ist ausgenommen. */
  rolle: Role;
  /** Zeitpunkt, gegen den geprueft wird. Vorgabe: jetzt. */
  jetzt?: Date;
}

/** Kalenderfelder eines Zeitpunkts in der Stationszeitzone. */
export function heuteInStationszeit(jetzt: Date = new Date()): {
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

/**
 * Fortlaufende Monatszahl. Damit ist der Vergleich zweier Monate eine
 * Subtraktion — und der Jahreswechsel keine Sonderbehandlung mehr. Genau daran
 * scheiterte die fruehere Fassung: Sie verglich Jahr und Monat einzeln und traf
 * den Dezember-Januar-Uebergang nie.
 */
function monatsZahl(jahr: number, monat: number): number {
  return jahr * 12 + (monat - 1);
}

/**
 * Anzahl der Tage eines Monats. Tag 0 des Folgemonats ist der letzte Tag des
 * gesuchten — in UTC gerechnet, weil hier nur Kalenderfelder zaehlen und keine
 * Ortszeit; die kommt aus `heuteInStationszeit`.
 */
export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

function zerlege(monat: string): { jahr: number; monat: number } | null {
  const treffer = /^(\d{4})-(\d{2})$/.exec(monat);
  if (!treffer) return null;
  const zahl = Number(treffer[2]);
  if (zahl < 1 || zahl > 12) return null;
  return { jahr: Number(treffer[1]), monat: zahl };
}

/** Der Monat eines Datums `YYYY-MM-DD` als `YYYY-MM`. */
export function monatVon(datum: string): string {
  return datum.slice(0, 7);
}

/**
 * Entscheidet, ob ein Monat fuer Eintragungen gesperrt ist.
 *
 * - Die Leitung ist nie gesperrt; sie plant.
 * - Der laufende Monat und alles davor sind gesperrt: Der Dienstplan haengt
 *   bereits, eine nachtraegliche Eintragung aendert daran nichts mehr (#33).
 * - Der Folgemonat schliesst **am** Stichtag, nicht erst danach. Ist der
 *   Stichtag laenger als der laufende Monat, gilt dessen letzter Tag.
 * - Weiter entfernte Monate sind offen.
 */
export function istMonatGesperrt({ monat, stichtag, rolle, jetzt }: SperrfristEingabe): boolean {
  if (rolle === 'Manager') return false;

  const ziel = zerlege(monat);
  // Ein unlesbarer Monat wird gesperrt, nicht durchgelassen: Im Zweifel lieber
  // eine Eintragung zu viel ablehnen als eine Sperre stillschweigend umgehen.
  if (!ziel) return true;

  const heute = heuteInStationszeit(jetzt);
  const abstand = monatsZahl(ziel.jahr, ziel.monat) - monatsZahl(heute.jahr, heute.monat);

  // `<= 0` schliesst den laufenden Monat ein. Das ist entschieden (#33), kein
  // Fluechtigkeitsfehler: Der Plan des laufenden Monats steht schon.
  if (abstand <= 0) return true;
  if (abstand === 1) {
    // Die Leitung darf jeden Tag von 1 bis 31 waehlen, ohne die Laenge der
    // einzelnen Monate im Kopf zu haben. Einen Stichtag, den es im laufenden
    // Monat nicht gibt, holt der letzte Tag dieses Monats ein — sonst bliebe
    // der Maerz bei Stichtag 31 den ganzen Februar ueber offen.
    const wirksam = Math.min(stichtag, tageImMonat(heute.jahr, heute.monat));
    return heute.tag >= wirksam;
  }
  return false;
}
