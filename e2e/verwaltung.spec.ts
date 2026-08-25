import { expect, test } from '@playwright/test';
import { anmelden, KONTEN, raeumeBenutzerAuf } from './hilfe';

test('Mitarbeitende sehen die Benutzerverwaltung gar nicht', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  await expect(page.getByRole('button', { name: /benutzer|verwaltung/i })).toHaveCount(0);
});

test('die Leitung legt eine Person an und wieder weg', async ({ page }) => {
  await anmelden(page, KONTEN.leitung);
  // Aufraeumen vor dem eigentlichen Test: Scheitert dieser Testlauf nach dem
  // Anlegen, antwortet der Server im CI-Wiederholungsversuch sonst mit 409
  // ("Name bereits vergeben"), weil Server und Testdatenbank fuer den ganzen
  // Lauf geteilt werden.
  await raeumeBenutzerAuf(page, 'Testperson Einmalig');
  await page.getByRole('button', { name: /benutzer|verwaltung/i }).first().click();

  await page.getByRole('button', { name: /hinzufügen|anlegen|neu/i }).first().click();
  await page.getByLabel(/name/i).fill('Testperson Einmalig');
  // Nicht /passwort/i: Das traefe auch die "Passwort neu vergeben"-Knoepfe
  // der schon vorhandenen Zeilen (eigenes aria-label je Person).
  await page.getByLabel('Initiales Passwort').fill('Test-Passwort-1');
  // Exakt "Speichern": /anlegen/i traefe zusaetzlich den Abbrechen-Knopf
  // ("Anlegen abbrechen").
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Zeilenscoped statt Text: Karten-Liste (Telefon) und Tabelle (Desktop)
  // liegen beide gleichzeitig im DOM, `getByText` traefe beide und meldete
  // einen Mehrdeutigkeitsfehler. `row` traegt nur die Tabellenzeile.
  await expect(page.getByRole('row', { name: /Testperson Einmalig/ })).toBeVisible();

  // Bestaetigung ueber das native <dialog> (src/components/Dialog.tsx) —
  // kein window.confirm, das den Browser blockieren wuerde.
  await page
    .getByRole('row', { name: /Testperson Einmalig/ })
    .getByRole('button', { name: /löschen|entfernen/i })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: /löschen/i }).click();

  await expect(page.getByRole('row', { name: /Testperson Einmalig/ })).toHaveCount(0);
});

test('der PDF-Export laedt nach und liefert eine Datei', async ({ page }) => {
  // jspdf und html2canvas liegen hinter einem import() (#14). Bricht das
  // Nachladen, merkt es sonst niemand — der Erststart bleibt ja schlank.
  await anmelden(page, KONTEN.leitung);

  const download = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: /pdf|export/i }).first().click();
  const datei = await download;

  expect(datei.suggestedFilename()).toMatch(/\.pdf$/i);
});
