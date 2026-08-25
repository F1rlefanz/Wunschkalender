import { expect, test } from '@playwright/test';
import { anmelden, GESPERRTER_MONAT, KONTEN, OFFENER_MONAT, zumMonat } from './hilfe';

test('im gesperrten Monat verschwinden die Loeschknoepfe', async ({ page }) => {
  // Bleiben sie stehen, laufen sie beim Klick in einen 403 — die Oberflaeche
  // verspricht dann etwas, das der Server nicht einhaelt.
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, GESPERRTER_MONAT);

  await expect(page.getByRole('button', { name: /entfernen|löschen/i })).toHaveCount(0);
});

test('im offenen Monat ist das Hinweisfeld da', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, OFFENER_MONAT);
  await expect(page.getByTestId('monatshinweis')).toBeVisible();
});

test('im gesperrten Monat bleibt das Hinweisfeld sichtbar, aber gesperrt', async ({ page }) => {
  // Anders als die Loeschknoepfe verschwindet das Hinweisfeld nicht: Ein
  // fruehers eingetragener Hinweis soll auch rueckblickend lesbar bleiben.
  // `disabled` verhindert jede Eingabe und damit auch jeden 403 — das
  // erfuellt denselben Zweck wie ein Verschwinden, nur lesbar statt leer.
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, GESPERRTER_MONAT);
  await expect(page.getByTestId('monatshinweis')).toBeVisible();
  await expect(page.getByTestId('monatshinweis')).toBeDisabled();
});

test('die Leitung darf auch im gesperrten Monat eintragen', async ({ page }) => {
  await anmelden(page, KONTEN.leitung);
  await zumMonat(page, GESPERRTER_MONAT);
  await expect(page.getByTestId('monatshinweis')).toBeVisible();
  await expect(page.getByTestId('monatshinweis')).toBeEnabled();
});

test('kein Klick im gesperrten Monat erzeugt einen Serverfehler', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, GESPERRTER_MONAT);

  // Erst NACH der Anmeldung mitschneiden: Der unangemeldete Aufruf von
  // `/api/me` beim ersten Laden der Seite liefert erwartbar 401 und waere
  // sonst ein falscher Treffer.
  const fehler: string[] = [];
  page.on('response', (antwort) => {
    if (antwort.status() >= 400 && antwort.url().includes('/api/')) {
      fehler.push(`${antwort.status()} ${antwort.url()}`);
    }
  });

  const tage = page.getByTestId(/^tag-/);
  // Belegt, dass ueberhaupt etwas gerendert wurde — sonst bestuende die
  // Zusicherung unten auch auf einer leeren oder kaputten Seite. Ein Monat
  // hat mindestens 28 Tage.
  const gesamtanzahl = await tage.count();
  expect(gesamtanzahl, 'keine Tageszellen gerendert').toBeGreaterThanOrEqual(28);

  const anzahl = Math.min(gesamtanzahl, 5);
  for (let i = 0; i < anzahl; i++) await tage.nth(i).click();

  // Ohne Warten wird eine Antwort, die noch unterwegs ist, nicht gezaehlt.
  // 'networkidle' wartet, bis 500ms lang keine Netzwerkaktivitaet mehr
  // aufgetreten ist — genug fuer einen durch den Klick ausgeloesten
  // Serveraufruf samt Antwort, ohne willkuerlich lange zu warten.
  await page.waitForLoadState('networkidle');

  expect(fehler).toEqual([]);
});
