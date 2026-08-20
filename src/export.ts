import type { MonthlyComment, ShiftType, User, Wish } from './types';

/**
 * Was im PDF-Export steht.
 *
 * Bewusst reine Funktionen ohne jsPDF: `handleExport` in `App.tsx` setzt daraus
 * nur noch die Tabellen zusammen, und was im Export landet, ist ohne PDF pruefbar.
 * Monat und Datum sind hier wie ueberall Zeichenketten (`YYYY-MM`, `YYYY-MM-DD`)
 * — `new Date(...)` haette am Jahreswechsel nur Zeitzonen ins Spiel gebracht.
 */

const SCHICHTNAMEN: Record<ShiftType, string> = {
  'Früh': 'Frühdienst',
  'Spät': 'Spätdienst',
  'Nacht': 'Nachtdienst',
  'Frei': 'Frei',
};

/** `YYYY-MM-DD` als `TT.MM.JJJJ`. */
export function datumDE(datum: string): string {
  const [jahr, monat, tag] = datum.split('-');
  return `${tag}.${monat}.${jahr}`;
}

/** `YYYY-MM` als `MM/JJJJ`. */
export function monatDE(monat: string): string {
  const [jahr, m] = monat.split('-');
  return `${m}/${jahr}`;
}

function namen(benutzer: User[]): Map<string, string> {
  return new Map(benutzer.map((b) => [b.id, b.name]));
}

/** Eine Zeile je Wunsch des Monats: Datum, Name, Schicht, Kommentar. */
export function wunschZeilen(wuensche: Wish[], benutzer: User[], monat: string): string[][] {
  const nameZu = namen(benutzer);
  return wuensche
    .filter((w) => w.date.startsWith(monat))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => [
      datumDE(w.date),
      nameZu.get(w.userId) || 'Unbekannt',
      SCHICHTNAMEN[w.shiftType] || w.shiftType,
      w.comment || '-',
    ]);
}

/**
 * Eine Zeile je Monatshinweis: Name, Hinweis — nach Namen sortiert, damit die
 * Dienstplanung die Randbedingungen einer Person an einer Stelle findet.
 *
 * Leere Hinweise bleiben draussen: Ein geleertes Feld wird gespeichert, es ist
 * aber keine Randbedingung und wuerde im PDF nur eine leere Zeile erzeugen.
 */
export function hinweisZeilen(
  hinweise: MonthlyComment[],
  benutzer: User[],
  monat: string,
): string[][] {
  const nameZu = namen(benutzer);
  return hinweise
    .filter((h) => h.month === monat && h.text.trim() !== '')
    .map((h) => ({ name: nameZu.get(h.userId) || 'Unbekannt', text: h.text.trim(), id: h.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id))
    .map((h) => [h.name, h.text]);
}
