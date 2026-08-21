import { automatischerStichtag, heutigerTag, monatVon } from './sperrfrist';

/**
 * Was die Leitung in der Einstellungsansicht eintippt, ist eine Zeichenkette —
 * der Vorlauf ist eine Zahl. Die Umrechnung samt Pruefung steht hier und nicht
 * in der Komponente, damit sie ohne Browser pruefbar ist.
 */

/** Obergrenze wie im `einstellungenSchema` des Servers — die Oberflaeche sagt es nur frueher. */
const HOECHSTER_VORLAUF = 365;

export type VorlaufErgebnis =
  // Ueber eine Zeichenkette unterschieden, nicht ueber ein Boolean: Ohne
  // `strictNullChecks` grenzt TypeScript eine Union sonst nicht ein.
  | { art: 'gut'; wert: number }
  | { art: 'fehler'; meldung: string };

/** Prueft eine Eingabe auf eine ganze Zahl von 0 bis 365. */
export function pruefeVorlauf(eingabe: string): VorlaufErgebnis {
  const text = eingabe.trim();
  const meldung = `Bitte eine Zahl zwischen 0 und ${HOECHSTER_VORLAUF} angeben.`;

  // `Number('')` ist 0 und `parseInt('56x')` ist 56 — beides waere hier ein
  // stiller Fehlgriff. Deshalb erst die Form pruefen, dann umrechnen.
  if (!/^\d+$/.test(text)) return { art: 'fehler', meldung };

  const wert = Number(text);
  if (wert > HOECHSTER_VORLAUF) return { art: 'fehler', meldung };

  return { art: 'gut', wert };
}

/**
 * Der erste Monat, an dem sich dieser Vorlauf noch zeigt. Er dient als
 * Beispiel: Eine Zahl allein sagt der Leitung nichts, ein Monat mit Datum
 * schon.
 *
 * Monate mit einem ausdruecklich gesetzten Stichtag werden uebersprungen — an
 * ihnen laesst sich die Automatik nicht zeigen, denn dort gilt sie nicht.
 */
export function ersterOffenerMonat(
  vorlaufTage: number,
  stichtage: Record<string, string> = {},
  jetzt?: Date,
): string {
  const heute = heutigerTag(jetzt);
  const [jahr, monat] = monatVon(heute).split('-').map(Number);

  // 24 Monate reichen: Bei hoechstens 365 Tagen Vorlauf ist spaetestens der
  // uebernaechste Jahresmonat offen. Die Schleife bricht also immer ab.
  for (let versatz = 0; versatz < 24; versatz++) {
    const kandidat = `${jahr + Math.floor((monat - 1 + versatz) / 12)}-${String(
      ((monat - 1 + versatz) % 12) + 1,
    ).padStart(2, '0')}`;
    if (stichtage[kandidat]) continue;
    const stichtag = automatischerStichtag(kandidat, vorlaufTage);
    if (stichtag && stichtag >= heute) return kandidat;
  }
  return monatVon(heute);
}

/** `2026-11` als `November 2026`. */
export function monatsname(monat: string): string {
  const [jahr, nummer] = monat.split('-').map(Number);
  return new Date(jahr, nummer - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
}

/** `2026-09-06` als `06.09.2026`. */
export function langesDatum(datum: string): string {
  const [jahr, monat, tag] = datum.split('-');
  return `${tag}.${monat}.${jahr}`;
}

/**
 * Sagt in einem Satz, was der eingestellte Vorlauf bewirkt — an einem echten
 * Monat, nicht abstrakt. Die Leitung muss die Wirkung lesen koennen, bevor sie
 * speichert.
 */
export function vorlaufErklaerung(
  vorlaufTage: number,
  stichtage: Record<string, string> = {},
  jetzt?: Date,
): string {
  const monat = ersterOffenerMonat(vorlaufTage, stichtage, jetzt);
  const stichtag = automatischerStichtag(monat, vorlaufTage);
  const satz = `Ein Monat schließt ${vorlaufTage} Tage vor seinem Beginn.`;
  if (!stichtag) return satz;
  return `${satz} ${monatsname(monat)} ist damit bis zum ${langesDatum(stichtag)} offen.`;
}
