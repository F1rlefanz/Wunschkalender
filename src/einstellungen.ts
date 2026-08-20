/**
 * Was die Leitung in der Einstellungsansicht eintippt, ist eine Zeichenkette —
 * der Stichtag ist eine Zahl. Die Umrechnung samt Pruefung steht hier und nicht
 * in der Komponente, damit sie ohne Browser pruefbar ist.
 */

/** Kleinster Monat im Kalender. Darueber hinaus braucht ein Stichtag Erklaerung. */
const KUERZESTER_MONAT = 28;

export type StichtagErgebnis =
  // Ueber eine Zeichenkette unterschieden, nicht ueber ein Boolean: Ohne
  // `strictNullChecks` grenzt TypeScript eine Union sonst nicht ein.
  | { art: 'gut'; wert: number }
  | { art: 'fehler'; meldung: string };

/**
 * Prueft eine Eingabe auf einen Tag zwischen 1 und 31. Dieselben Grenzen wie
 * `einstellungenSchema` im Server — die Oberflaeche sagt es nur frueher.
 */
export function pruefeStichtag(eingabe: string): StichtagErgebnis {
  const text = eingabe.trim();
  const meldung = 'Bitte einen Tag zwischen 1 und 31 angeben.';

  // `Number('')` ist 0 und `parseInt('15x')` ist 15 — beides waere hier ein
  // stiller Fehlgriff. Deshalb erst die Form pruefen, dann umrechnen.
  if (!/^\d+$/.test(text)) return { art: 'fehler', meldung };

  const wert = Number(text);
  if (wert < 1 || wert > 31) return { art: 'fehler', meldung };

  return { art: 'gut', wert };
}

/**
 * Sagt in einem Satz, was der eingestellte Tag bewirkt. Die Zahl allein ist
 * fuer die Leitung bedeutungslos — sie muss die Wirkung lesen koennen, bevor
 * sie speichert.
 */
export function stichtagErklaerung(stichtag: number): string {
  const satz = `Ab dem ${stichtag}. eines Monats können Mitarbeitende den Folgemonat nicht mehr ändern.`;
  if (stichtag <= KUERZESTER_MONAT) return satz;
  // Sonst wirkt ein Stichtag 31 im Februar wie ein Fehler, obwohl die Sperre
  // dort am letzten Tag greift (siehe `istMonatGesperrt`).
  return `${satz} In Monaten ohne diesen Tag gilt der letzte Tag des Monats.`;
}
