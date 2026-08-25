import { expect, test } from '@playwright/test';
import { anmelden, KONTEN, raeumeStichtagAuf, STICHTAG_MONAT, zumMonat } from './hilfe';

/**
 * Der Weg, auf dem die Leitung die Sperrfrist eines einzelnen Monats setzt,
 * war bislang zu 0 % geprueft (Abschlusspruefung Punkt 7): Die
 * Browsertests setzen Stichtage bewusst am Store vorbei
 * (`e2e/server-starten.ts`), und `src/components/Einstellungen.tsx` wird von
 * keinem Test angefasst. Damit war auch der `settings_updated`-Listener in
 * `App.tsx` ungeprueft — ein vertauschtes PUT/DELETE oder ein nicht
 * ankommendes Ereignis haette nichts rot gemacht.
 *
 * Zwei Browserkontexte wie in echtzeit.spec.ts: Die Leitung setzt den
 * Stichtag im Kalenderkopf (nicht in Einstellungen.tsx — dort steht nur der
 * globale Vorlauf, der Stichtag eines einzelnen Monats sitzt bewusst im
 * Monatskopf, #36). Eine zweite, angemeldete Person bekommt die Wirkung OHNE
 * Neuladen zu sehen — das belegt sowohl den REST-Weg als auch das
 * `settings_updated`-Ereignis.
 */
test('ein von der Leitung gesetzter Stichtag sperrt und entsperrt den Monat live', async ({ browser }) => {
  const leitungKontext = await browser.newContext();
  const mitarbeitKontext = await browser.newContext();
  const leitungSeite = await leitungKontext.newPage();
  const mitarbeitSeite = await mitarbeitKontext.newPage();

  await anmelden(leitungSeite, KONTEN.leitung);
  await anmelden(mitarbeitSeite, KONTEN.mitarbeit);
  // Aufraeumen vor dem eigentlichen Test: Dieser Test setzt den Stichtag
  // probeweise auf die Vergangenheit und nimmt ihn erst am Ende zurueck.
  // Scheitert er dazwischen, bliebe der Monat in der geteilten Testdatenbank
  // gesperrt — derselbe Rueckfall, den Befund 4 fuer Benutzer und Wuensche
  // schon abstellt.
  await raeumeStichtagAuf(leitungSeite, STICHTAG_MONAT);
  await zumMonat(leitungSeite, STICHTAG_MONAT);
  await zumMonat(mitarbeitSeite, STICHTAG_MONAT);

  // Vorher: Der automatische Vorschlag liegt weit in der Zukunft (Monat 5–9
  // Monate voraus, Vorlauf 56 Tage) — der Monat ist offen, das Hinweisfeld
  // bedienbar.
  await expect(mitarbeitSeite.getByTestId('monatshinweis')).toBeEnabled();

  // Die Leitung oeffnet den Stichtag-Editor im Monatskopf und setzt einen
  // Stichtag in der Vergangenheit. Der Knopf traegt ein aria-label
  // "Stichtag für <Monat Jahr> ändern" (Calendar.tsx); das Eingabefeld selbst
  // ist per `sr-only`-Label "Stichtag für <Monat Jahr>" (ohne "ändern")
  // beschriftet.
  const monatJahr = await leitungSeite.getByTestId('monatskopf').locator('h1').innerText();
  await leitungSeite.getByRole('button', { name: `Stichtag für ${monatJahr} ändern` }).click();
  await leitungSeite.getByLabel(`Stichtag für ${monatJahr}`, { exact: true }).fill('2020-01-01');
  await leitungSeite.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Ohne Neuladen bei der Mitarbeiterin: Das Hinweisfeld wird gesperrt.
  await expect(mitarbeitSeite.getByTestId('monatshinweis')).toBeDisabled({ timeout: 5000 });
  // Die Leitung selbst bleibt ausgenommen (#33) — bedienbar trotz Sperre.
  await expect(leitungSeite.getByTestId('monatshinweis')).toBeEnabled();

  // Die Leitung nimmt den gesetzten Stichtag zurueck — zurueck zur Automatik.
  // Das Speichern hat den Editor geschlossen (speichereStichtag setzt
  // stichtagOffen zurueck auf false); erst wieder oeffnen.
  await leitungSeite.getByRole('button', { name: `Stichtag für ${monatJahr} ändern` }).click();
  await leitungSeite.getByRole('button', { name: 'Automatik' }).click();

  // Ohne Neuladen: Der Monat oeffnet sich fuer die Mitarbeiterin wieder.
  await expect(mitarbeitSeite.getByTestId('monatshinweis')).toBeEnabled({ timeout: 5000 });

  await leitungKontext.close();
  await mitarbeitKontext.close();
});
