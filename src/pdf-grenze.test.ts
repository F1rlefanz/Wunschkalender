import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * `CLAUDE.md` haelt fest: `src/pdf.ts` ist die einzige Stelle mit einem
 * `jspdf`-Import, weil jeder statische Import anderswo `jspdf` und
 * `html2canvas` (zusammen ~625 kB) zurueck in den Erststart holt (#14) — das
 * Nachladen per `import()` in `App.tsx` bringt dann nichts mehr. Bis hierher
 * hielt diese Regel nur ein Kommentar durch; ein statischer Import in einer
 * anderen Datei baut sauber und testet gruen. Dieser Test liest jede Datei
 * unter `src/` ausser `pdf.ts` selbst und schlaegt fehl, sobald dort eines
 * der schweren PDF-Pakete importiert wird.
 */

const WURZEL = path.join(__dirname);
const VERBOTENE_PAKETE = ['jspdf', 'jspdf-autotable', 'html2canvas'];
// pdf.ts darf die Pakete importieren; diese Datei nennt ihre Namen selbst
// in Kommentar und Muster, ohne sie zu importieren.
const AUSNAHMEN = [path.join(WURZEL, 'pdf.ts'), path.join(WURZEL, 'pdf-grenze.test.ts')];

function sammleDateien(verzeichnis: string): string[] {
  const treffer: string[] = [];
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    const vollerPfad = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      treffer.push(...sammleDateien(vollerPfad));
    } else if (/\.(ts|tsx)$/.test(eintrag.name)) {
      treffer.push(vollerPfad);
    }
  }
  return treffer;
}

test('nur pdf.ts importiert jspdf, jspdf-autotable oder html2canvas', () => {
  const verstoesse: string[] = [];

  for (const datei of sammleDateien(WURZEL)) {
    if (AUSNAHMEN.includes(datei)) continue;
    const inhalt = fs.readFileSync(datei, 'utf-8');
    for (const paket of VERBOTENE_PAKETE) {
      // Sowohl statisches `import ... from 'jspdf'` als auch `import('jspdf')`
      // treffen — beides holte das Paket in den Erststart zurueck.
      const muster = new RegExp(`from\\s+['"]${paket}['"]|import\\(\\s*['"]${paket}['"]\\s*\\)`);
      if (muster.test(inhalt)) {
        verstoesse.push(`${path.relative(WURZEL, datei)} importiert '${paket}'`);
      }
    }
  }

  expect(verstoesse, verstoesse.join('\n')).toEqual([]);
});
