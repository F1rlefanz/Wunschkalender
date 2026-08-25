import { expect, type Page } from '@playwright/test';
import { heutigerTag } from '../src/sperrfrist';

export const KONTEN = {
  leitung: { name: 'Anna Leitung', passwort: 'Test-Passwort-1' },
  mitarbeit: { name: 'Max Mustermann', passwort: 'Test-Passwort-1' },
  zweite: { name: 'Lena Beispiel', passwort: 'Test-Passwort-1' },
};

/**
 * Monate relativ zum heutigen Tag statt fest verdrahtet weit in der Zukunft
 * (Fix-Runde 1 zu Aufgabe 9): Die Oberflaeche hat kein Sprungfeld — `zumMonat`
 * blaettert einzeln per Pfeil-Knopf, und ein fest verdrahteter Monat wie
 * `2099-06` waere mit jedem vergehenden Jahr mehr Klicks entfernt (zuletzt
 * 876 pro Navigation, ~30s). Die Determiniertheit von "offen"/"gesperrt"
 * kommt ausschliesslich vom Stichtag, den `server-starten.ts` ausdruecklich
 * setzt — nicht von der Entfernung zum heutigen Tag. `heutigerTag()` rechnet
 * dieselbe Zeitzone (`Europe/Berlin`) wie der Server; `new Date().toISOString()`
 * waere UTC und ginge nachts bis zu zwei Stunden daneben.
 */
function monatIndex(jahr: number, monat: number): number {
  return jahr * 12 + (monat - 1);
}

function monatVonIndex(index: number): string {
  const jahr = Math.floor(index / 12);
  const monat = (index % 12) + 1;
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}`;
}

const [heuteJahr, heuteMonat] = heutigerTag().split('-').map(Number);
const heuteIndex = monatIndex(heuteJahr, heuteMonat);

/** Zwei Monate nach heute — offen, mit Stichtag weit in der Zukunft. */
export const OFFENER_MONAT = monatVonIndex(heuteIndex + 2);
/** Ein Monat vor heute — gesperrt, mit Stichtag in der Vergangenheit. */
export const GESPERRTER_MONAT = monatVonIndex(heuteIndex - 1);

/** Naechster erreichbarer Dezember (bei Bedarf der laufende Monat selbst). */
const monateBisDezember = heuteMonat === 12 ? 0 : 12 - heuteMonat;
const dezemberIndex = heuteIndex + monateBisDezember;
/** Fuer den Jahreswechsel-Test: Dezember ... */
export const DEZEMBER = monatVonIndex(dezemberIndex);
/** ... und der unmittelbar folgende Januar, ueber den Jahreswechsel hinweg. */
export const JANUAR_DANACH = monatVonIndex(dezemberIndex + 1);

/**
 * Eigener Monat fuer den Stichtag-Test (Aufgabe 7): Muss sich von allen
 * anderen hier berechneten Monaten unterscheiden, sonst beeinflusst der Test
 * ueber die gemeinsame Testdatenbank die anderen. Die Kandidaten 5–9 Monate
 * nach heute sind weit genug von OFFENER_MONAT (+2) und GESPERRTER_MONAT (-1)
 * entfernt; DEZEMBER/JANUAR_DANACH wandern mit dem Kalenderjahr, deshalb der
 * erste Kandidat, der mit keinem der vier kollidiert.
 */
const VERGEBENE_INDIZES = new Set([
  heuteIndex + 2,
  heuteIndex - 1,
  dezemberIndex,
  dezemberIndex + 1,
]);
const stichtagIndex = [5, 6, 7, 8, 9].map((offset) => heuteIndex + offset).find((i) => !VERGEBENE_INDIZES.has(i))!;
/** Eigens fuer den Stichtag-Test — von keiner anderen Testdatei benutzt. */
export const STICHTAG_MONAT = monatVonIndex(stichtagIndex);

/**
 * Loescht eine Person mit diesem Namen ueber die REST-API, falls sie existiert
 * — noetig, weil Server und Testdatenbank fuer den ganzen Browserlauf geteilt
 * werden und `retries: 1` (CI) einen fehlgeschlagenen Test sonst mit bereits
 * angelegten Daten neu starten liesse. Muss nach der Anmeldung, aber vor dem
 * Anlegen der Person aufgerufen werden (braucht die angemeldete Sitzung von
 * `page`, die einen `GET`/`DELETE` auf `/api/users` darf).
 */
export async function raeumeBenutzerAuf(seite: Page, name: string) {
  const antwort = await seite.request.get('/api/users');
  const benutzer = await antwort.json();
  const treffer = benutzer.find((b: { id: string; name: string }) => b.name === name);
  if (treffer) await seite.request.delete(`/api/users/${treffer.id}`);
}

/**
 * Setzt den Stichtag eines Monats auf Automatik zurueck, falls die Leitung
 * einen gesetzt hat — dieselbe Absicherung wie `raeumeBenutzerAuf` und
 * `raeumeWunschAuf`, fuer `einstellungen.spec.ts`: Der Test setzt einen
 * Stichtag probeweise auf die Vergangenheit und nimmt ihn erst am Ende
 * zurueck. Scheitert er dazwischen, bliebe der Monat in der geteilten
 * Testdatenbank gesperrt, und der naechste Lauf (Wiederholungsversuch oder
 * ein erneuter Entwicklungslauf) scheiterte sofort an der Zusicherung, dass
 * das Hinweisfeld bedienbar ist. Gutmuetig, wenn kein Stichtag gesetzt ist:
 * `DELETE` auf einen bereits automatischen Monat antwortet mit 200.
 */
export async function raeumeStichtagAuf(seite: Page, monat: string) {
  await seite.request.delete(`/api/stichtage/${monat}`);
}

/**
 * Loescht alle eigenen Wuensche an diesem Datum ueber die REST-API, falls
 * vorhanden — aus demselben Grund wie `raeumeBenutzerAuf`: Scheitert ein Test
 * nach dem Anlegen eines Wunsches, liegen im CI-Wiederholungsversuch sonst
 * zwei Wuensche auf dem Tag, von denen nur einer geloescht wird. Muss nach
 * der Anmeldung aufgerufen werden.
 */
export async function raeumeWunschAuf(seite: Page, datum: string) {
  const [meAntwort, wuenscheAntwort] = await Promise.all([
    seite.request.get('/api/me'),
    seite.request.get('/api/wishes'),
  ]);
  const { user } = await meAntwort.json();
  const wuensche: Array<{ id: string; userId: string; date: string }> = await wuenscheAntwort.json();
  const eigene = wuensche.filter((w) => w.userId === user.id && w.date === datum);
  for (const wunsch of eigene) {
    await seite.request.delete(`/api/wishes/${wunsch.id}`);
  }
}

/** Meldet im aktuellen Kontext an und wartet, bis der Kalender steht. */
export async function anmelden(seite: Page, konto: { name: string; passwort: string }) {
  await seite.goto('/');
  await seite.getByLabel(/name/i).fill(konto.name);
  await seite.getByLabel(/passwort/i).fill(konto.passwort);
  await seite.getByRole('button', { name: /anmelden/i }).click();
  await expect(seite.getByRole('button', { name: /abmelden|profil/i }).first()).toBeVisible();
}

/** Blaettert den Kalender auf den gewuenschten Monat. */
export async function zumMonat(seite: Page, monat: string) {
  const [jahr, m] = monat.split('-').map(Number);
  const ziel = jahr * 12 + (m - 1);
  for (let i = 0; i < 2000; i++) {
    const kopf = await seite.getByTestId('monatskopf').getAttribute('data-monat');
    if (kopf === monat) return;
    const [aktJahr, aktM] = (kopf ?? '').split('-').map(Number);
    const jetzt = aktJahr * 12 + (aktM - 1);
    await seite.getByRole('button', { name: jetzt < ziel ? /nächster monat/i : /voriger monat/i }).click();
  }
  throw new Error(`Monat ${monat} nicht erreicht`);
}
