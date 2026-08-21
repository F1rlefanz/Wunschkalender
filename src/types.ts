/**
 * Mindestlaenge fuer Passwoerter. Steht hier und nicht im Servermodul, weil die
 * Oberflaeche sie nennen muss — und weil das Servermodul argon2 mitbraechte,
 * das nichts im Browser-Bundle zu suchen hat.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Die Schichtarten als Wert, nicht nur als Typ: Der Server muss eingehende
 * Angaben dagegen pruefen koennen, und zwei Listen liefen frueher oder spaeter
 * auseinander.
 */
export const SHIFT_TYPES = ['Früh', 'Spät', 'Nacht', 'Frei'] as const;

export type ShiftType = (typeof SHIFT_TYPES)[number];

export type Role = 'Manager' | 'Employee';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Wish {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  comment: string;
  shiftType: ShiftType;
}

export interface MonthlyComment {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  text: string;
}

export interface Settings {
  /**
   * Vorlauf des automatischen Vorschlags in Tagen: So lange vor Monatsbeginn
   * schliesst ein Monat, fuer den nichts Ausdrueckliches hinterlegt ist.
   */
  vorlaufTage: number;
  /**
   * Ausdruecklich gesetzte Stichtage, `YYYY-MM` auf `YYYY-MM-DD`. Sie schlagen
   * den Vorschlag und werden von ihm nie ueberschrieben (#36).
   */
  stichtage: Record<string, string>;
}
