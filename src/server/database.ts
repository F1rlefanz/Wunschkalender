import Database from 'better-sqlite3';

/**
 * Legt eine Datenbank an und stellt sicher, dass das Schema vorhanden ist.
 *
 * `path` ist ein Dateipfad oder `:memory:` fuer Tests.
 */
export function createDatabase(path: string) {
  const db = new Database(path);

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

    CREATE TABLE IF NOT EXISTS sessions (
      sid    TEXT PRIMARY KEY,
      sess   TEXT NOT NULL,
      expire INTEGER NOT NULL
    );
  `);

  return db;
}
