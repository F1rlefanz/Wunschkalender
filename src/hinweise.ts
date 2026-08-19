import type { MonthlyComment, User } from './types';

/**
 * Welche Monatshinweise unter der Ueberschrift eines Monats stehen.
 *
 * Hinweise haengen an einem Monat als `YYYY-MM`-Zeichenkette (siehe
 * `MonthlyComment.month`). Wer hier nur nach Person filtert, zeigt die Hinweise
 * aller Monate unter der Ueberschrift eines einzelnen — genau das war der Fehler,
 * den diese Funktionen ersetzen.
 */

/** Hinweise anderer Personen zum dargestellten Monat. */
export function fremdeHinweise(
  hinweise: MonthlyComment[],
  monat: string,
  benutzer: User | null,
): MonthlyComment[] {
  if (!benutzer) return [];
  // Mitarbeitende sehen im Hinweisfeld nur sich selbst; alles Weitere waere
  // Anzeige ohne Nutzen beim Eintragen.
  if (benutzer.role === 'Employee') return [];
  return hinweise.filter((h) => h.month === monat && h.userId !== benutzer.id);
}

/** Der eigene Hinweis zum dargestellten Monat, falls es ihn schon gibt. */
export function eigenerHinweis(
  hinweise: MonthlyComment[],
  monat: string,
  benutzer: User | null,
): MonthlyComment | undefined {
  if (!benutzer) return undefined;
  return hinweise.find((h) => h.month === monat && h.userId === benutzer.id);
}

/** Zuletzt aus den Daten uebernommener Feldinhalt, samt Person und Monat. */
export interface Uebernommen {
  /** `benutzerId|YYYY-MM` — wechselt er, gehoert das Feld einem anderen Monat. */
  schluessel: string;
  text: string;
}

export interface Serverstand {
  schluessel: string;
  /** Was der Server zu diesem Monat kennt; leer, wenn es dort nichts gibt. */
  serverText: string;
  /** Was gerade im Eingabefeld steht. */
  feldText: string;
  uebernommen: Uebernommen;
}

/**
 * Entscheidet, ob ein eintreffender Serverstand in das Eingabefeld darf.
 *
 * Ohne diese Unterscheidung setzte jedes Socket-Ereignis das Feld zurueck:
 * schrieb ein Kollege, verschwand der eigene, noch ungespeicherte Text.
 * Getipptes hat deshalb Vorrang — ausser der Monat wechselt, dann gehoert das
 * Feld ohnehin einem anderen Hinweis.
 */
export function uebernehmeServerstand({
  schluessel,
  serverText,
  feldText,
  uebernommen,
}: Serverstand): { feldText: string; uebernommen: Uebernommen } {
  const gleicherHinweis = uebernommen.schluessel === schluessel;
  const ungespeichertes = gleicherHinweis && feldText !== uebernommen.text;

  if (ungespeichertes) {
    // Stimmt der Server inzwischen mit dem Feld ueberein, ist das eigene
    // Speichern zurueckgekommen: der Stand ist dann wieder bekannt.
    return {
      feldText,
      uebernommen: serverText === feldText ? { schluessel, text: serverText } : uebernommen,
    };
  }

  return { feldText: serverText, uebernommen: { schluessel, text: serverText } };
}
