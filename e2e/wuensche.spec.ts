import { expect, test } from '@playwright/test';
import { anmelden, DEZEMBER, JANUAR_DANACH, KONTEN, OFFENER_MONAT, zumMonat } from './hilfe';

/**
 * Ein Tag ist in der Rasteransicht kein einzelner Knopf, sondern eine Zelle
 * mit mehreren Knoepfen darin: der (immer vorhandene) Auswahl-Umschalter
 * liegt als `absolute inset-0` HINTER dem Inhalt (#16), damit Wunschzettel
 * und der "ansehen"-Knopf eigene Knoepfe bleiben. Playwright klickt eine
 * Zielflaeche standardmaessig in ihrer Mitte — die liegt bei einem Tag mit
 * schon vorhandenen Wuenschen genau auf diesen oben liegenden Knoepfen, die
 * den Klick abfangen. Ein Klick in die obere linke Ecke der Zelle trifft
 * garantiert nur den Umschalter, unabhaengig davon, ob der Tag schon
 * Wuensche traegt.
 */
async function tagAuswaehlen(page: import('@playwright/test').Page, datum: string) {
  await page
    .getByTestId(`tag-${datum}`)
    .getByRole('button')
    .first()
    .click({ position: { x: 8, y: 8 } });
}

/** Oeffnet den Eintragen-Dialog fuer die aktuelle Auswahl, waehlt die Schicht und speichert. */
async function wunschEintragen(page: import('@playwright/test').Page, schicht: 'Früh' | 'Spät' | 'Nacht' | 'Frei') {
  await page.getByRole('button', { name: /wunsch eintragen/i }).click();
  await page.getByLabel('Schichtart').selectOption(schicht);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
}

test('ein Wunsch laesst sich setzen und wieder entfernen', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, OFFENER_MONAT);

  const datum = `${OFFENER_MONAT}-15`;
  await tagAuswaehlen(page, datum);
  await wunschEintragen(page, 'Früh');

  const tag = page.getByTestId(`tag-${datum}`);
  await expect(tag).toContainText('Früh');

  // Nach dem Neuladen ist er immer noch da — er lag also wirklich im Server.
  await page.reload();
  await zumMonat(page, OFFENER_MONAT);
  await expect(page.getByTestId(`tag-${datum}`)).toContainText('Früh');

  // Loeschen laeuft ueber den "ansehen"-Dialog: In der Zelle selbst haengt
  // der Loeschen-Knopf am Hover-Zustand (#15) und ist damit fuer Playwright
  // ohne echte Zeigerbewegung ein unzuverlaessiger Weg.
  await page.getByTestId(`tag-${datum}`).getByRole('button', { name: /ansehen/i }).click();
  // Es gibt zwei "löschen"-Knoepfe zu diesem Wunsch: den (versteckt hinter
  // Hover) direkt in der Rasterzelle und den im gerade geoeffneten Dialog.
  // Ohne Eingrenzung auf den Dialog meldet Playwright einen
  // Mehrdeutigkeitsfehler (strict mode violation).
  await page.getByRole('dialog').getByRole('button', { name: /löschen/i }).click();
  await expect(page.getByTestId(`tag-${datum}`)).not.toContainText('Früh');
});

test('derselbe Wunsch erscheint in allen drei Ansichten', async ({ page }) => {
  // Raster, Liste und Matrix liegen in einer Datei. Wer eine aendert, bricht
  // leicht die anderen — genau das faengt dieser Test.
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, OFFENER_MONAT);

  const datum = `${OFFENER_MONAT}-15`;
  await tagAuswaehlen(page, datum);
  await wunschEintragen(page, 'Nacht');

  // Die Ansichtswahl traegt die Bezeichnungen aus der Oberflaeche
  // ("Kalender"/"Tagesliste"/"Mitarbeiter-Matrix"), nicht "Raster"/"Liste"/
  // "Matrix" wie in der Vorlage geraten. Der Header traegt ausserdem einen
  // eigenen "Kalender"-Wegweiser (#-Navigation) mit demselben Namen — ohne
  // Eingrenzung auf die Gruppe "Ansicht wählen" trifft der Ausdruck beide.
  const ansichtswahl = page.getByRole('group', { name: 'Ansicht wählen' });
  for (const ansicht of ['Kalender', 'Tagesliste', 'Mitarbeiter-Matrix']) {
    await ansichtswahl.getByRole('button', { name: ansicht, exact: true }).click();
    await expect(page.getByTestId('ansicht')).toContainText('Nacht');
  }
});

test('ein Wunsch liegt im richtigen Monat, auch ueber den Jahreswechsel', async ({ page }) => {
  // Die Sperrfrist rechnet mit jahr * 12 + monat. Dezember zu Januar ist die
  // Stelle, an der Datumslogik am haeufigsten um einen Monat verrutscht.
  await anmelden(page, KONTEN.leitung); // die Leitung ist nirgends gesperrt
  await zumMonat(page, DEZEMBER);

  const dezemberTag = `${DEZEMBER}-31`;
  await tagAuswaehlen(page, dezemberTag);
  await wunschEintragen(page, 'Spät');
  await expect(page.getByTestId(`tag-${dezemberTag}`)).toContainText('Spät');

  await page.getByRole('button', { name: /nächster monat/i }).click();
  await expect(page.getByTestId('monatskopf')).toHaveAttribute('data-monat', JANUAR_DANACH);
  await expect(page.getByTestId('ansicht')).not.toContainText('Spät');

  await page.getByRole('button', { name: /voriger monat/i }).click();
  await expect(page.getByTestId('monatskopf')).toHaveAttribute('data-monat', DEZEMBER);
  await expect(page.getByTestId(`tag-${dezemberTag}`)).toContainText('Spät');
});
