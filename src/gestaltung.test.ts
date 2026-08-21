import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  FLAECHENPAARE,
  TEXTPAARE,
  kontrast,
  lesePaletten,
  leuchtdichte,
  type Palette,
} from './gestaltung';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const paletten = lesePaletten(css);

/**
 * Der Kern von #21: Die Kontraste sind gerechnet, nicht geschaetzt. Der
 * Sekundaertext des Corporate Designs (#726D68) ist an dieser Pruefung
 * gescheitert — deshalb steht in `index.css` ein abgedunkelter Wert.
 */
describe('Gestaltungsgrundlage', () => {
  it('rechnet Kontraste nach WCAG', () => {
    expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(kontrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Reihenfolge darf keine Rolle spielen.
    expect(kontrast('#2d2a28', '#f0edea')).toBeCloseTo(kontrast('#f0edea', '#2d2a28'), 10);
    expect(leuchtdichte('#ffffff')).toBeCloseTo(1, 5);
  });

  it('findet beide Paletten', () => {
    expect(Object.keys(paletten.hell).length).toBeGreaterThan(10);
    expect(paletten.hell.hintergrund).toBe('#f0edea');
    expect(paletten.dunkel.hintergrund).toBe('#1c1b1a');
  });

  it('deckt jede helle Rolle auch im Dunkelmodus ab', () => {
    // Eine vergessene dunkle Rolle faellt sonst erst nachts auf dem Telefon
    // auf: Die Rolle behielte still ihren hellen Wert.
    const fehlend = Object.keys(paletten.hell).filter((rolle) => !(rolle in paletten.dunkel));
    expect(fehlend).toEqual([]);
  });

  for (const [modus, palette] of Object.entries(paletten) as [string, Palette][]) {
    describe(modus, () => {
      it.each(TEXTPAARE)('$zweck traegt Text ($vorne auf $hinten)', ({ vorne, hinten }) => {
        const wert = pruefeVorhanden(palette, vorne, hinten);
        expect(wert, `${vorne} auf ${hinten} (${modus})`).toBeGreaterThanOrEqual(4.5);
      });

      it.each(FLAECHENPAARE)('$zweck ist erkennbar ($vorne auf $hinten)', ({ vorne, hinten }) => {
        const wert = pruefeVorhanden(palette, vorne, hinten);
        expect(wert, `${vorne} auf ${hinten} (${modus})`).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

function pruefeVorhanden(palette: Palette, vorne: string, hinten: string): number {
  const a = palette[vorne];
  const b = palette[hinten];
  if (!a || !b) {
    throw new Error(`Rolle fehlt in der Palette: ${!a ? vorne : hinten}`);
  }
  return kontrast(a, b);
}
