import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { hashPassword } from './passwords';
import { SHIFT_TYPES, type Role } from '../types';

/**
 * Der Beispielmodus fuellt eine leere Datenbank mit erfundenen Daten, damit man
 * die Anwendung herzeigen kann, ohne sich vorher Konten anzulegen.
 *
 * Ein Modus mit bekannten Passwoertern ist eine Hintertuer, wenn er je im
 * Echtbetrieb anspringt. Deshalb **zwei** Sicherungen, die beide greifen
 * muessen:
 *
 * 1. Er laeuft nur, wenn `BEISPIELDATEN` ausdruecklich gesetzt ist.
 * 2. Er verweigert den Start, wenn die Datenbank bereits Konten enthaelt, die
 *    nicht aus dem Beispielmodus stammen. Lieber steht die Testfassung still,
 *    als dass sie sich ueber eine echte Aufstellung legt.
 *
 * Siehe `docs/betrieb.md`.
 */

/** Steht auf der Anmeldeseite. Gilt fuer alle Beispielkonten. */
export const BEISPIEL_PASSWORT = 'beispiel2026';

/**
 * Verraet einer bereits gefuellten Datenbank an, dass sie aus dem
 * Beispielmodus stammt. Ohne diese Marke gilt jede vorhandene Datenbank als
 * echte Aufstellung — die sichere Richtung des Irrtums.
 */
const MARKE = 'beispieldaten';

export interface Beispielkonto {
  name: string;
  rolle: Role;
}

/**
 * Erkennbar erfunden. Keine Namen echter Kolleginnen, auch nicht abgewandelt.
 */
export const BEISPIEL_KONTEN: Beispielkonto[] = [
  { name: 'Beate Beispiel', rolle: 'Manager' },
  { name: 'Petra Probe', rolle: 'Employee' },
  { name: 'Manfred Muster', rolle: 'Employee' },
  { name: 'Tanja Testfall', rolle: 'Employee' },
  { name: 'Erik Erfunden', rolle: 'Employee' },
];

export type Beispielbefund =
  /** `BEISPIELDATEN` ist nicht gesetzt — der Normalfall. */
  | { art: 'aus' }
  /** Frisch angelegt. */
  | { art: 'angelegt'; konten: number; wuensche: number; hinweise: number }
  /** Die Datenbank stammt bereits aus einem frueheren Beispielstart. */
  | { art: 'vorhanden' }
  /** Der Start ist zu verweigern. */
  | { art: 'verweigert'; grund: string };

/** Ausdrueckliche Zustimmung, in den ueblichen Schreibweisen. */
export function beispielmodusGewuenscht(env: Record<string, string | undefined>): boolean {
  const norm = (env.BEISPIELDATEN ?? '').trim().toLowerCase();
  return norm === '1' || norm === 'an' || norm === 'true' || norm === 'ja';
}

/** Ob diese Datenbank die Marke des Beispielmodus traegt. */
export function traegtBeispielmarke(db: Database): boolean {
  const zeile = db.prepare('SELECT value FROM settings WHERE key = ?').get(MARKE) as
    | { value: string }
    | undefined;
  return zeile?.value === 'an';
}

export async function richteBeispieldatenEin(
  db: Database,
  env: Record<string, string | undefined>,
  heute: Date,
): Promise<Beispielbefund> {
  if (!beispielmodusGewuenscht(env)) return { art: 'aus' };

  const { n } = db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };

  if (n > 0) {
    if (traegtBeispielmarke(db)) return { art: 'vorhanden' };
    return {
      art: 'verweigert',
      grund:
        `BEISPIELDATEN ist gesetzt, aber die Datenbank enthaelt bereits ${n} Konto/Konten ` +
        'ohne die Marke des Beispielmodus. Der Beispielmodus legt Konten mit oeffentlich ' +
        'bekanntem Passwort an und darf sich nicht ueber eine echte Aufstellung legen. ' +
        'Entweder BEISPIELDATEN entfernen oder einen leeren Datenordner verwenden.',
    };
  }

  // Passwoerter einmal rechnen: alle Beispielkonten teilen dasselbe.
  const hash = await hashPassword(BEISPIEL_PASSWORT);
  const monate = dreiMonate(heute);

  const kennungen = new Map<string, string>();
  let wuensche = 0;
  let hinweise = 0;

  db.transaction(() => {
    const legeKonto = db.prepare(
      'INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)',
    );
    for (const konto of BEISPIEL_KONTEN) {
      const id = randomUUID();
      kennungen.set(konto.name, id);
      legeKonto.run(id, konto.name, konto.rolle, hash);
    }

    const legeWunsch = db.prepare(
      'INSERT INTO wishes (id, user_id, date, shift_type, comment) VALUES (?, ?, ?, ?, ?)',
    );
    const pflege = BEISPIEL_KONTEN.filter((k) => k.rolle === 'Employee');
    pflege.forEach((konto, i) => {
      const userId = kennungen.get(konto.name)!;
      monate.forEach((monat, m) => {
        for (const [t, tag] of tage(i).entries()) {
          const schicht = SHIFT_TYPES[(i + m + t) % SHIFT_TYPES.length];
          legeWunsch.run(
            randomUUID(),
            userId,
            `${monat}-${String(tag).padStart(2, '0')}`,
            schicht,
            '',
          );
          wuensche++;
        }
      });
    });

    const legeHinweis = db.prepare(
      'INSERT INTO monthly_comments (id, user_id, month, text) VALUES (?, ?, ?, ?)',
    );
    const notizen: [string, string, string][] = [
      [pflege[0].name, monate[1], 'Zweite Woche Fortbildung, deshalb nur Fruehdienste.'],
      [pflege[2].name, monate[2], 'Am Wochenende nach Weihnachten bitte moeglichst frei.'],
    ];
    for (const [name, monat, text] of notizen) {
      legeHinweis.run(randomUUID(), kennungen.get(name)!, monat, text);
      hinweise++;
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(MARKE, 'an');
  })();

  return { art: 'angelegt', konten: BEISPIEL_KONTEN.length, wuensche, hinweise };
}

/**
 * Der laufende und die beiden folgenden Monate als `YYYY-MM`.
 *
 * Gerechnet wird ueber `jahr * 12 + monat`, nicht ueber `Date`-Arithmetik: Ein
 * Kalendermonat ist kein Zeitraum fester Laenge, und der Jahreswechsel ist
 * genau die Stelle, an der das auffaellt.
 */
function dreiMonate(heute: Date): string[] {
  const basis = heute.getFullYear() * 12 + heute.getMonth();
  return [0, 1, 2].map((versatz) => {
    const gesamt = basis + versatz;
    const jahr = Math.floor(gesamt / 12);
    const monat = (gesamt % 12) + 1;
    return `${jahr}-${String(monat).padStart(2, '0')}`;
  });
}

/**
 * Tage im Monat, an denen diese Pflegekraft einen Wunsch hat. Bewusst alle
 * <= 28: Sonst faellt der Februar aus dem Kalender.
 */
function tage(i: number): number[] {
  return [3 + i, 8 + i, 14 + i * 2, 21 + i, 26];
}
