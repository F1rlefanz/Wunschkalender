import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loeseDatenpfade } from './daten-ordner';

const CWD = path.resolve('/anwendung');

describe('loeseDatenpfade', () => {
  test('legt die Daten ohne Angabe ins Arbeitsverzeichnis', () => {
    const pfade = loeseDatenpfade({}, CWD);

    expect(pfade.ordner).toBe(CWD);
    expect(pfade.quelle).toBe('arbeitsverzeichnis');
    expect(pfade.datenbank).toBe(path.join(CWD, 'data.sqlite'));
    expect(pfade.altJson).toBe(path.join(CWD, 'db.json'));
    expect(pfade.geheimnis).toBe(path.join(CWD, 'sitzungsgeheimnis'));
  });

  test('folgt DATEN_ORDNER, wenn er gesetzt ist', () => {
    const ziel = path.resolve('/daten');
    const pfade = loeseDatenpfade({ DATEN_ORDNER: ziel }, CWD);

    expect(pfade.ordner).toBe(ziel);
    expect(pfade.quelle).toBe('DATEN_ORDNER');
    expect(pfade.datenbank).toBe(path.join(ziel, 'data.sqlite'));
    expect(pfade.geheimnis).toBe(path.join(ziel, 'sitzungsgeheimnis'));
  });

  test('versteht eine relative Angabe als relativ zum Arbeitsverzeichnis', () => {
    const pfade = loeseDatenpfade({ DATEN_ORDNER: 'daten' }, CWD);

    expect(pfade.ordner).toBe(path.join(CWD, 'daten'));
  });

  test('behandelt eine leere Angabe wie keine', () => {
    for (const wert of ['', '   ']) {
      const pfade = loeseDatenpfade({ DATEN_ORDNER: wert }, CWD);
      expect(pfade.ordner).toBe(CWD);
      expect(pfade.quelle).toBe('arbeitsverzeichnis');
    }
  });
});
