import Database from 'better-sqlite3';

/**
 * Ein durchnummerierter Schritt zum aktuellen Schema.
 *
 * `PRAGMA user_version` haelt fest, welche Nummer eine Datenbank schon erreicht
 * hat; beim Start laufen genau die fehlenden Schritte der Reihe nach.
 *
 * **Wer das Schema aendert, haengt hier einen Schritt mit der naechsten Nummer
 * an** — und aendert einen bestehenden Schritt nicht mehr, denn der ist auf den
 * laufenden Installationen bereits gelaufen. Ab Schritt 2 darf ein Schritt
 * geradeheraus `ALTER TABLE` sagen: Der Stand davor ist durch die Nummer
 * bekannt, Pruefungen auf vorhandene Spalten sind dort ueberfluessig.
 */
type SchemaSchritt = {
  nummer: number;
  zweck: string;
  anwenden: (db: Database.Database) => void;
};

const SCHEMA_SCHRITTE: SchemaSchritt[] = [
  {
    nummer: 1,
    zweck: 'Grundschema',
    // Schritt 1 ist die Sammelstelle fuer alles vor der Nummerierung: Eine
    // Datenbank auf Stand 0 ist entweder frisch oder stammt aus einer Fassung
    // ohne `user_version`, und welche das war, laesst sich nicht mehr sagen.
    // Deshalb ist dieser eine Schritt bewusst tastend (`IF NOT EXISTS`, Blick
    // auf die Spalten). Ab Schritt 2 ist das nicht mehr noetig.
    anwenden: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL UNIQUE,
          role          TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          auth_provider TEXT NOT NULL DEFAULT 'local',
          entra_oid     TEXT
        );

        CREATE TABLE IF NOT EXISTS wishes (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date       TEXT NOT NULL,
          shift_type TEXT NOT NULL,
          comment    TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS monthly_comments (
          id      TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          month   TEXT NOT NULL,
          text    TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Ausdruecklich gesetzte Stichtage, ein Monat eine Zeile. Eine eigene
        -- Tabelle und kein Feld in settings: Der Vorschlag ist eine Einstellung,
        -- der gesetzte Stichtag eine Entscheidung ueber einen einzelnen Monat.
        -- Fehlt die Zeile, greift der Vorschlag (#36).
        CREATE TABLE IF NOT EXISTS stichtage (
          monat  TEXT PRIMARY KEY,
          datum  TEXT NOT NULL
        );

        -- user_id ist bewusst eine eigene Spalte und nicht nur ein Feld in sess:
        -- Damit ist der Widerruf aller Sitzungen einer Person ein DELETE, und beim
        -- Loeschen eines Kontos verschwinden sie ohne Aufraeumcode mit.
        CREATE TABLE IF NOT EXISTS sessions (
          sid     TEXT PRIMARY KEY,
          sess    TEXT NOT NULL,
          expire  INTEGER NOT NULL,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      const sitzungsspalten = db
        .prepare('PRAGMA table_info(sessions)')
        .all()
        .map((spalte: any) => spalte.name);

      if (!sitzungsspalten.includes('user_id')) {
        // Sitzungen sind wegwerfbar: Neu anlegen ist ehrlicher als eine Spalte
        // nachzuruesten, deren Werte fuer die bestehenden Zeilen ohnehin fehlen.
        // Betroffene melden sich einmal neu an; Benutzerdaten bleiben unberuehrt.
        db.exec(`
          DROP TABLE IF EXISTS sessions;
          CREATE TABLE sessions (
            sid     TEXT PRIMARY KEY,
            sess    TEXT NOT NULL,
            expire  INTEGER NOT NULL,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE
          );
        `);
      }

      // `bookingDeadlineDay` war ein Tag des Monats, der immer auf den Folgemonat
      // wirkte. Der Stichtag ist jetzt ein Datum je Monat (#36) — ein alter Wert
      // laesst sich nicht sinnvoll umrechnen und bliebe sonst als toter Schluessel
      // liegen.
      db.prepare("DELETE FROM settings WHERE key = 'bookingDeadlineDay'").run();
    },
  },
];

/** Die Nummer, die eine Datenbank nach allen Schritten traegt. */
export const SCHEMA_STAND = SCHEMA_SCHRITTE[SCHEMA_SCHRITTE.length - 1].nummer;

/**
 * Legt eine Datenbank an und bringt sie auf den aktuellen Schemastand.
 *
 * `path` ist ein Dateipfad oder `:memory:` fuer Tests.
 */
export function createDatabase(path: string, vorhandene?: Database.Database) {
  const db = vorhandene ?? new Database(path);

  // Fremdschluessel sind bei better-sqlite3 zwar vorgabegemaess an, aber davon
  // haengt ab, ob ON DELETE CASCADE greift — deshalb ausdruecklich gesetzt.
  db.pragma('foreign_keys = ON');
  // Damit sich zwei gleichzeitig gestartete Instanzen nicht gegenseitig sperren.
  db.pragma('journal_mode = WAL');

  wendeSchemaSchritteAn(db);

  return db;
}

/**
 * Wendet die noch fehlenden Schemaschritte der Reihe nach an.
 *
 * Jeder Schritt laeuft mitsamt seiner neuen Nummer in **einer** Transaktion:
 * Bricht er ab, bleibt die Datenbank auf dem Stand davor stehen — nie auf einem
 * halben. Ein zweiter Start findet nichts mehr zu tun.
 */
export function wendeSchemaSchritteAn(db: Database.Database) {
  const stand = db.pragma('user_version', { simple: true }) as number;

  for (const schritt of SCHEMA_SCHRITTE) {
    if (schritt.nummer <= stand) continue;

    db.transaction(() => {
      schritt.anwenden(db);
      db.pragma(`user_version = ${schritt.nummer}`);
    })();
  }
}
