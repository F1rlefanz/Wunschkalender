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
 * - Vergangene Monate sind gesperrt.
 * - Der Folgemonat schliesst **am** Stichtag, nicht erst danach.
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

  if (abstand < 0) return true;
  if (abstand === 1) return heute.tag >= stichtag;
  return false;
}
