import fs from 'node:fs';
import path from 'node:path';

/**
 * Wo die Anwendung ihre Dateien ablegt, entscheidet der Betrieb — nicht der
 * Code. Siehe `docs/betrieb.md`.
 *
 * Ohne Angabe bleibt alles im Arbeitsverzeichnis, wie es fuer die Entwicklung
 * gewohnt ist. In einem Container liegt der Code aber an einer Stelle und der
 * dauerhafte Datentraeger an einer anderen: Ohne `DATEN_ORDNER` waeren die
 * Daten beim naechsten Start weg.
 */
export interface Datenpfade {
  /** Verzeichnis, in dem alle drei Dateien liegen. */
  ordner: string;
  /** Die SQLite-Datenbank. */
  datenbank: string;
  /** Der einmalig zu uebernehmende Altbestand aus der JSON-Fassung. */
  altJson: string;
  /** Das Sitzungsgeheimnis, falls es nicht ueber die Umgebung kommt. */
  geheimnis: string;
  /** Woher der Ordner stammt — fuer die Startmeldung. */
  quelle: 'DATEN_ORDNER' | 'arbeitsverzeichnis';
}

export function loeseDatenpfade(
  env: Record<string, string | undefined>,
  arbeitsverzeichnis: string,
): Datenpfade {
  const angabe = (env.DATEN_ORDNER ?? '').trim();
  // Eine relative Angabe ist relativ zum Arbeitsverzeichnis gemeint, nicht zum
  // Ort dieser Datei.
  const ordner = angabe === '' ? arbeitsverzeichnis : path.resolve(arbeitsverzeichnis, angabe);

  return {
    ordner,
    datenbank: path.join(ordner, 'data.sqlite'),
    altJson: path.join(ordner, 'db.json'),
    geheimnis: path.join(ordner, 'sitzungsgeheimnis'),
    quelle: angabe === '' ? 'arbeitsverzeichnis' : 'DATEN_ORDNER',
  };
}

/**
 * Legt den Ordner an, falls er fehlt. Ein leerer Datentraeger ist der
 * Normalfall beim ersten Start eines Containers; ohne das scheitert erst
 * `better-sqlite3`, und zwar mit einer Meldung, die nicht nach der Ursache
 * aussieht.
 */
export function stelleDatenordnerBereit(pfade: Datenpfade): void {
  fs.mkdirSync(pfade.ordner, { recursive: true });
}
