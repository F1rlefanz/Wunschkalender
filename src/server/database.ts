import Database from 'better-sqlite3';

/**
 * Legt eine Datenbank an und stellt sicher, dass das Schema vorhanden ist.
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

  passeSchemaAn(db);

  return db;
}

/**
 * Bringt eine Datenbank aus einer aelteren Fassung auf den aktuellen Stand.
 *
 * `CREATE TABLE IF NOT EXISTS` ruehrt eine vorhandene Tabelle nicht an — ohne
 * diesen Schritt liefe der Server gegen ein veraltetes Schema und scheiterte
 * erst beim ersten Anmelden.
 */
function passeSchemaAn(db: Database.Database) {
  const spalten = db
    .prepare('PRAGMA table_info(sessions)')
    .all()
    .map((spalte: any) => spalte.name);

  if (!spalten.includes('user_id')) {
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
}
