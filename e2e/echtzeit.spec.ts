import { expect, test } from '@playwright/test';
import { anmelden, KONTEN, OFFENER_MONAT, zumMonat } from './hilfe';

test('was A eintraegt, sieht B ohne Neuladen', async ({ browser }) => {
  // Schreiben laeuft optimistisch ueber Sockets: Fehlt das io.emit oder der
  // Listener in App.tsx, faellt das erst hier auf.
  const kontextA = await browser.newContext();
  const kontextB = await browser.newContext();
  const seiteA = await kontextA.newPage();
  const seiteB = await kontextB.newPage();

  await anmelden(seiteA, KONTEN.mitarbeit);
  await anmelden(seiteB, KONTEN.zweite);
  await zumMonat(seiteA, OFFENER_MONAT);
  await zumMonat(seiteB, OFFENER_MONAT);

  await seiteA
    .getByTestId(`tag-${OFFENER_MONAT}-20`)
    .getByRole('button')
    .first()
    .click({ position: { x: 8, y: 8 } });
  await seiteA.getByRole('button', { name: /wunsch eintragen/i }).click();
  await seiteA.getByLabel('Schichtart').selectOption('Frei');
  await seiteA.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Die Rasteransicht zeigt Mitarbeitenden nur die eigenen Eintraege
  // (Uebersichtlichkeit, keine Sicherheitsmassnahme) — B ist hier eine
  // andere Person als A und saehe in Raster oder Liste deshalb nichts.
  // Die Mitarbeiter-Matrix zeigt dagegen ausdruecklich alle Wuensche.
  await seiteB.getByRole('group', { name: 'Ansicht wählen' }).getByRole('button', { name: 'Mitarbeiter-Matrix', exact: true }).click();

  // Ohne Neuladen: B bekommt es ueber das Socket-Ereignis.
  await expect(seiteB.getByTestId('ansicht')).toContainText('Frei', { timeout: 5000 });

  await kontextA.close();
  await kontextB.close();
});

test('Getipptes wird von einem eintreffenden Ereignis nicht ueberschrieben', async ({ browser }) => {
  // Sonst geht mitten im Satz verloren, was jemand gerade schreibt.
  const kontextA = await browser.newContext();
  const kontextB = await browser.newContext();
  const seiteA = await kontextA.newPage();
  const seiteB = await kontextB.newPage();

  await anmelden(seiteA, KONTEN.mitarbeit);
  await anmelden(seiteB, KONTEN.zweite);
  await zumMonat(seiteA, OFFENER_MONAT);
  await zumMonat(seiteB, OFFENER_MONAT);

  await seiteA.getByTestId('monatshinweis').fill('Ich tippe gerade noch');

  // B loest ein Ereignis aus, das bei A ankommt.
  await seiteB.getByTestId('monatshinweis').fill('Von der anderen Seite');
  await seiteB.getByTestId('monatshinweis').blur();

  await seiteA.waitForTimeout(1500);
  await expect(seiteA.getByTestId('monatshinweis')).toHaveValue('Ich tippe gerade noch');

  await kontextA.close();
  await kontextB.close();
});
