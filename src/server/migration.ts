import fs from 'node:fs';
import type { Database } from 'better-sqlite3';
import { hashPassword } from './passwords';

/** Passwort, mit dem die fruehere Fassung alle Demo-Konten angelegt hat. */
const DEMO_PASSWORD = 'password';

/** Schluessel, an dem haengt, ob bereits migriert wurde. */
const MIGRATION_KEY = 'migriert_am';

export interface MigrationResult {
  migrated: boolean;
  users: number;
  wishes: number;
  comments: number;
  warnings: string[];
}

const nichtsGetan: MigrationResult = {
  migrated: false,
  users: 0,
  wishes: 0,
  comments: 0,
  warnings: [],
};

/**
 * Uebertraegt eine vorhandene `db.json` einmalig nach SQLite.
 *
 * Ob bereits migriert wurde, haengt an einer Zeile **in der Datenbank**, nicht
 * am Dateinamen: Das Umbenennen der Quelldatei kann unter Windows an einem
 * offenen Handle scheitern (Virenscanner, Editor, Dateisynchronisation), und
 * daran darf weder ein Serverstart haengen noch eine zweite Migration.
 *
 * Alle Einfuegungen laufen in einer Transaktion — bricht es ab, ist nichts
 * halb importiert.
 */
export async function migrateFromJson(db: Database, jsonPath: string): Promise<MigrationResult> {
  const bereitsMigriert = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(MIGRATION_KEY);
  if (bereitsMigriert) return nichtsGetan;

  if (!fs.existsSync(jsonPath)) return nichtsGetan;

  const vorhandeneBenutzer = db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
  if (vorhandeneBenutzer.n > 0) {
    throw new Error(
      `In der Datenbank stehen bereits ${vorhandeneBenutzer.n} Benutzer, und zugleich liegt ${jsonPath} vor. ` +
        'Es ist nicht entscheidbar, welcher Stand gilt. Bitte die nicht mehr benoetigte Quelle von Hand entfernen.',
    );
  }

  let daten: any;
  try {
    daten = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (fehler) {
    // Bewusst weiterwerfen statt zu ignorieren: Die frueher hier uebliche
    // stille Behandlung wuerde die Datei als "erledigt" abhaken und die Daten
    // damit verlieren.
    throw new Error(
      `${jsonPath} laesst sich nicht lesen (${(fehler as Error).message}). ` +
        'Die Datei wurde nicht veraendert. Bitte pruefen, bevor der Server erneut startet.',
    );
  }

  const users: any[] = daten.users ?? [];
  const wishes: any[] = daten.wishes ?? [];
  const comments: any[] = daten.monthlyComments ?? [];

  const doppelte = findeDoppelteNamen(users);
  if (doppelte.length > 0) {
    throw new Error(
      `Diese Namen kommen mehrfach vor: ${doppelte.join(', ')}. ` +
        'Weil die Anmeldung ueber den Namen laeuft, muessen Namen eindeutig sein. ' +
        'Bitte in der Quelldatei bereinigen — automatisch umzubenennen wuerde bedeuten, ' +
        'dass jemand seinen Anmeldenamen aendert, ohne es zu erfahren.',
    );
  }

  // Hashing ist asynchron, Transaktionen in better-sqlite3 sind es nicht.
  // Deshalb alle Hashes vorher berechnen.
  const warnings: string[] = [];
  const vorbereitet = await Promise.all(
    users.map(async (u) => {
      if (u.password === DEMO_PASSWORD) {
        warnings.push(
          `Konto "${u.name}" wurde mit dem bekannten Demo-Passwort uebernommen und sollte geaendert werden.`,
        );
      }
      return {
        id: String(u.id),
        name: String(u.name).trim(),
        role: u.role === 'Manager' ? 'Manager' : 'Employee',
        hash: await hashPassword(String(u.password ?? ''), { skipLengthCheck: true }),
      };
    }),
  );

  const einfuegen = db.transaction(() => {
    const benutzer = db.prepare(
      'INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)',
    );
    for (const u of vorbereitet) benutzer.run(u.id, u.name, u.role, u.hash);

    const wunsch = db.prepare(
      'INSERT INTO wishes (id, user_id, date, shift_type, comment) VALUES (?, ?, ?, ?, ?)',
    );
    for (const w of wishes) {
      wunsch.run(String(w.id), String(w.userId), String(w.date), String(w.shiftType), String(w.comment ?? ''));
    }

    const hinweis = db.prepare(
      'INSERT INTO monthly_comments (id, user_id, month, text) VALUES (?, ?, ?, ?)',
    );
    for (const c of comments) {
      hinweis.run(String(c.id), String(c.userId), String(c.month), String(c.text ?? ''));
    }

    const einstellung = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(daten.settings ?? {})) {
      // `bookingDeadlineDay` war ein Tag des Monats und ist inzwischen bedeutungslos.
      // Er liesse sich nicht in einen Vorlauf umrechnen; ihn zu uebernehmen
      // hiesse, einen toten Schluessel mitzuschleppen.
      if (key === 'bookingDeadlineDay') continue;
      einstellung.run(key, String(value));
    }
    einstellung.run(MIGRATION_KEY, new Date().toISOString());
  });

  einfuegen();

  benenneQuelleUm(jsonPath);

  return { migrated: true, users: users.length, wishes: wishes.length, comments: comments.length, warnings };
}

function findeDoppelteNamen(users: any[]): string[] {
  const gesehen = new Set<string>();
  const doppelt = new Set<string>();
  for (const u of users) {
    // Dieselbe Vergleichsregel wie bei Anmeldung und Unique-Index: exakt nach Trim.
    const name = String(u.name).trim();
    if (gesehen.has(name)) doppelt.add(name);
    gesehen.add(name);
  }
  return [...doppelt];
}

/**
 * Raeumt die Quelldatei weg. Scheitert das, ist die Migration trotzdem gueltig —
 * sie haengt an der Datenbank, nicht an diesem Dateinamen.
 */
function benenneQuelleUm(jsonPath: string) {
  try {
    fs.renameSync(jsonPath, `${jsonPath}.migriert`);
  } catch (fehler) {
    console.warn(
      `Hinweis: ${jsonPath} konnte nach der Migration nicht umbenannt werden ` +
        `(${(fehler as Error).message}). Die Migration ist dennoch abgeschlossen und ` +
        'wiederholt sich nicht. Die Datei enthaelt alte Passwoerter im Klartext und sollte entfernt werden.',
    );
  }
}
