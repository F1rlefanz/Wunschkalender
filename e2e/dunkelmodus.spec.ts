import { expect, test } from '@playwright/test';
import { anmelden, KONTEN, OFFENER_MONAT, zumMonat } from './hilfe';

test.use({ colorScheme: 'dark' });

/** Wahrgenommene Helligkeit einer `rgb(...)`-Angabe, 0 bis 1. */
const helligkeit = (farbe: string): number | null => {
  const treffer = farbe.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!treffer) return null;
  const [, r, g, b, a] = treffer;
  if (a !== undefined && Number(a) < 0.5) return null; // durchsichtig zaehlt nicht
  return (0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b)) / 255;
};

test('im Dunkelmodus ist der Hintergrund dunkel', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  const farbe = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const h = helligkeit(farbe);
  expect(h, `body-Hintergrund ist ${farbe}`).not.toBeNull();
  expect(h!).toBeLessThan(0.3);
});

test('keine sichtbare Flaeche leuchtet weiss', async ({ page }) => {
  // Eine eingestreute Farbe bricht den Dunkelmodus still. Deshalb: neue Rolle
  // in index.css anlegen statt einen Wert einstreuen.
  await anmelden(page, KONTEN.mitarbeit);
  await zumMonat(page, OFFENER_MONAT);

  const auffaellige = await page.evaluate(() => {
    const treffer: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const kasten = el.getBoundingClientRect();
      if (kasten.width < 8 || kasten.height < 8) continue;
      const stil = getComputedStyle(el);
      if (stil.visibility === 'hidden' || stil.display === 'none') continue;
      const m = stil.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) continue;
      if (m[4] !== undefined && Number(m[4]) < 0.5) continue;
      const hell = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
      if (hell > 0.75) {
        treffer.push(`${el.tagName.toLowerCase()}.${el.className} → ${stil.backgroundColor}`);
      }
    }
    return treffer;
  });

  expect(auffaellige, `Helle Flaechen im Dunkelmodus:\n${auffaellige.join('\n')}`).toEqual([]);
});

test('alle drei Ansichten bleiben dunkel', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  // Die Ansichtswahl traegt die Bezeichnungen aus der Oberflaeche
  // ("Kalender"/"Tagesliste"/"Mitarbeiter-Matrix"), nicht "Raster"/"Liste"/
  // "Matrix" wie geraten. Eingrenzung auf die Gruppe "Ansicht wählen": Der
  // Header traegt ausserdem einen eigenen "Kalender"-Wegweiser mit demselben
  // Namen, ohne Eingrenzung traefe der Ausdruck beide.
  const ansichtswahl = page.getByRole('group', { name: 'Ansicht wählen' });
  for (const ansicht of ['Kalender', 'Tagesliste', 'Mitarbeiter-Matrix']) {
    await ansichtswahl.getByRole('button', { name: ansicht, exact: true }).click();
    // Die Tagesliste traegt selbst keinen Hintergrund (nur `space-y-raum4`)
    // und erbt ihn vom Vorfahren. Ein durchsichtiger Behaelter ist kein
    // Mangel — aber die Zusicherung darf deshalb nicht stillschweigend
    // ausfallen. Deshalb bis zum naechsten Vorfahren mit gesetztem
    // Hintergrund hochlaufen und den pruefen.
    const farbe = await page.evaluate(() => {
      const istDurchsichtig = (wert: string) => {
        const treffer = wert.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!treffer) return true;
        const alpha = treffer[4];
        return alpha !== undefined && Number(alpha) < 0.5;
      };
      let el: Element | null = document.querySelector('[data-testid="ansicht"]');
      while (el) {
        const stil = getComputedStyle(el).backgroundColor;
        if (!istDurchsichtig(stil)) return stil;
        el = el.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    });
    const h = helligkeit(farbe);
    expect(h, `${ansicht}: ${farbe}`).not.toBeNull();
    expect(h!, `${ansicht}: ${farbe}`).toBeLessThan(0.4);
  }
});
