import { randomBytes, randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { hashPassword } from './passwords';

const DEFAULT_NAME = 'Leitung';

export interface SeedResult {
  created: boolean;
  name?: string;
  /** Nur beim Anlegen gesetzt. Danach ist es nirgends mehr auslesbar. */
  password?: string;
}

/**
 * Stellt sicher, dass mindestens ein Leitungskonto existiert.
 *
 * Ohne Leitung waere die Installation unbedienbar — niemand koennte Konten
 * anlegen oder Einstellungen aendern. Gibt es bereits eine, passiert nichts:
 * Sonst entstuende neben vorhandenen Konten unbemerkt ein weiteres
 * Verwaltungskonto, dessen Passwort nur in einem Serverprotokoll steht.
 */
export async function ensureManagerAccount(db: Database): Promise<SeedResult> {
  const vorhanden = db
    .prepare("SELECT count(*) AS n FROM users WHERE role = 'Manager'")
    .get() as { n: number };
  if (vorhanden.n > 0) return { created: false };

  const name = findeFreienNamen(db);
  const password = erzeugePasswort();

  db.prepare('INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    name,
    'Manager',
    await hashPassword(password),
  );

  return { created: true, name, password };
}

function findeFreienNamen(db: Database): string {
  const belegt = db.prepare('SELECT 1 FROM users WHERE name = ?');
  if (!belegt.get(DEFAULT_NAME)) return DEFAULT_NAME;

  for (let i = 2; i < 100; i++) {
    const kandidat = `${DEFAULT_NAME} ${i}`;
    if (!belegt.get(kandidat)) return kandidat;
  }
  return `${DEFAULT_NAME} ${randomUUID().slice(0, 8)}`;
}

/**
 * Gut lesbar am Telefon oder auf einem Zettel: Gruppen aus einem Alphabet ohne
 * verwechselbare Zeichen (kein O/0, kein I/l/1).
 */
function erzeugePasswort(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  const zeichen = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [
    zeichen.slice(0, 4).join(''),
    zeichen.slice(4, 8).join(''),
    zeichen.slice(8, 12).join(''),
    zeichen.slice(12, 16).join(''),
  ].join('-');
}
