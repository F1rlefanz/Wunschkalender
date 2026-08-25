import { expect, type Page } from '@playwright/test';

export const KONTEN = {
  leitung: { name: 'Anna Leitung', passwort: 'Test-Passwort-1' },
  mitarbeit: { name: 'Max Mustermann', passwort: 'Test-Passwort-1' },
  zweite: { name: 'Lena Beispiel', passwort: 'Test-Passwort-1' },
};

/** Stichtag ausdruecklich in der Zukunft — offen, unabhaengig vom heutigen Tag. */
export const OFFENER_MONAT = '2099-06';
/** Stichtag ausdruecklich in der Vergangenheit — zu. */
export const GESPERRTER_MONAT = '2020-01';

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
