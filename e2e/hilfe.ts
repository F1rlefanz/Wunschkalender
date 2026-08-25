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
