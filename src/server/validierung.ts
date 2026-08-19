import { z } from 'zod';
import { SHIFT_TYPES } from '../types';

/**
 * Was der Server aus einem Anfragekoerper uebernimmt — und was nicht.
 *
 * Jedes Schema ist bewusst *streng*: unbekannte Felder sind ein Fehler, kein
 * stiller Zusatz. Ohne das landete alles, was jemand mitschickt, in der
 * Datenbank — samt einer fremden `userId`, obwohl der Server sie aus der
 * Sitzung nimmt.
 *
 * Die Mindestlaenge von Passwoertern steht hier absichtlich *nicht*: sie
 * gehoert zu `passwords.ts` und soll nicht an zwei Stellen gepflegt werden.
 * Hier steht nur eine Obergrenze, damit niemand dem Hashverfahren ein
 * Megabyte zu kauen gibt.
 */
export const GRENZEN = {
  name: 80,
  passwort: 200,
  wunschKommentar: 500,
  monatshinweis: 2000,
} as const;

const TAGE_IM_MONAT = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const istSchaltjahr = (jahr: number) => (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;

/**
 * Prueft `YYYY-MM-DD` als Kalendertag — ohne `Date`. Der 30. Februar ist kein
 * Tag; `new Date('2026-02-30')` haette daraus stillschweigend den 2. Maerz
 * gemacht und den Wunsch in einem anderen Monat abgelegt.
 */
export function istKalendertag(wert: string): boolean {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  if (!treffer) return false;
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  if (monat < 1 || monat > 12) return false;
  const laenge = monat === 2 && istSchaltjahr(jahr) ? 29 : TAGE_IM_MONAT[monat - 1];
  return tag >= 1 && tag <= laenge;
}

const datum = z
  .string('date muss ein Datum im Format YYYY-MM-DD sein.')
  .refine(istKalendertag, 'date muss ein gueltiger Kalendertag im Format YYYY-MM-DD sein.');

const monat = z
  .string('month muss ein Monat im Format YYYY-MM sein.')
  .refine((wert) => {
    const treffer = /^(\d{4})-(\d{2})$/.exec(wert);
    return treffer !== null && Number(treffer[2]) >= 1 && Number(treffer[2]) <= 12;
  }, 'month muss ein Monat im Format YYYY-MM sein.');

const rolle = z.enum(['Manager', 'Employee'], 'role muss entweder Manager oder Employee sein.');

const name = z
  .string('Name fehlt.')
  .trim()
  .min(1, 'Name fehlt.')
  .max(GRENZEN.name, `Der Name darf hoechstens ${GRENZEN.name} Zeichen lang sein.`);

const passwort = z
  .string('Passwort fehlt.')
  .min(1, 'Passwort fehlt.')
  .max(GRENZEN.passwort, `Das Passwort darf hoechstens ${GRENZEN.passwort} Zeichen lang sein.`);

export const anmeldungSchema = z.strictObject({ name: z.string().max(GRENZEN.name), password: passwort });

export const benutzerAnlegenSchema = z.strictObject({
  name,
  role: rolle.default('Employee'),
  password: passwort,
});

export const benutzerAendernSchema = z.strictObject({
  name: name.optional(),
  role: rolle.optional(),
});

export const passwortAendernSchema = z.strictObject({
  oldPassword: passwort,
  newPassword: passwort,
});

export const passwortZuruecksetzenSchema = z.strictObject({ newPassword: passwort });

export const einstellungenSchema = z.strictObject({
  bookingDeadlineDay: z
    .int('bookingDeadlineDay muss eine Zahl zwischen 1 und 31 sein.')
    .min(1, 'bookingDeadlineDay muss eine Zahl zwischen 1 und 31 sein.')
    .max(31, 'bookingDeadlineDay muss eine Zahl zwischen 1 und 31 sein.'),
});

export const wunschSchema = z.strictObject({
  date: datum,
  shiftType: z.enum(SHIFT_TYPES, `shiftType muss eine der Schichtarten ${SHIFT_TYPES.join(', ')} sein.`),
  comment: z
    .string()
    .max(GRENZEN.wunschKommentar, `Der Kommentar darf hoechstens ${GRENZEN.wunschKommentar} Zeichen lang sein.`)
    .optional()
    .default(''),
});

export const monatshinweisSchema = z.strictObject({
  month: monat,
  text: z
    .string()
    .max(GRENZEN.monatshinweis, `Der Hinweis darf hoechstens ${GRENZEN.monatshinweis} Zeichen lang sein.`)
    .optional()
    .default(''),
});

/**
 * Zwei Faelle mit *Zeichenketten* als Unterscheidungsmerkmal, nicht mit
 * `ok: true | false`: Solange `strictNullChecks` aus ist (Issue #19), grenzt
 * TypeScript eine Union ueber ein Boolean-Literal nicht ein — `eingabe.fehler`
 * waere dann ein Typfehler, obwohl der Fall geprueft ist.
 */
export type Ergebnis<T> = { art: 'gut'; wert: T } | { art: 'fehler'; fehler: string };

/**
 * Prueft einen Anfragekoerper und liefert entweder den bereinigten Wert oder
 * eine Meldung, die man einer Nutzerin zeigen kann. Es wird bewusst nur der
 * erste Mangel gemeldet — eine Liste aller Fehler hilft hier niemandem.
 */
export function pruefe<S extends z.ZodType>(schema: S, koerper: unknown): Ergebnis<z.infer<S>> {
  const ergebnis = schema.safeParse(koerper);
  if (ergebnis.success) return { art: 'gut', wert: ergebnis.data };

  const mangel = ergebnis.error.issues[0];
  if (mangel.code === 'unrecognized_keys') {
    return { art: 'fehler', fehler: `Unbekanntes Feld: ${mangel.keys.join(', ')}` };
  }
  const pfad = mangel.path.join('.');
  return { art: 'fehler', fehler: pfad ? `${pfad}: ${mangel.message}` : mangel.message };
}
