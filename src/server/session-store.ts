import { Store, type SessionData } from 'express-session';
import type { Database } from 'better-sqlite3';

/**
 * `express-session` kennt von Haus aus nur `cookie`. Ohne diese Erweiterung
 * waere jeder Zugriff auf `req.session.userId` ein Typfehler — und die Schleuse
 * liesse keinen Merge durch. Sie steht hier, weil diese Datei ausschliesslich
 * serverseitig importiert wird und `tsconfig.json` `src/` einschliesst.
 */
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

/**
 * Sitzungsspeicher fuer `express-session` auf Basis der vorhandenen Datenbank.
 *
 * Warum eigener Code statt eines Pakets: Der naheliegende
 * `better-sqlite3-session-store` ist GPL-lizenziert (alles uebrige hier ist
 * MIT), steht seit 2022 bei Version 0.1.0, setzt Sitzungen ohne `maxAge`
 * stillschweigend auf 24 Stunden und haelt den Node-Prozess mit einem nicht
 * abschaltbaren Timer am Leben — was jeden Testlauf haengen liesse. Die
 * gesichteten Alternativen sind entweder ebenso unbewegt, ohne Lizenzangabe
 * oder braechten einen zweiten nativen SQLite-Treiber mit.
 *
 * `express-session` selbst bleibt und leistet weiterhin das Schwierige:
 * Cookie-Signierung, Lebenszyklus, Schutz gegen Session-Fixation. Hier steht
 * nur die Ablage.
 */
export class SqliteSessionStore extends Store {
  constructor(private readonly db: Database) {
    super();
    this.pruneExpired();
  }

  get(sid: string, callback: (err?: unknown, session?: SessionData | null) => void): void {
    try {
      const row: any = this.db
        .prepare('SELECT sess, expire FROM sessions WHERE sid = ?')
        .get(sid);

      if (!row) return callback(null, null);
      if (row.expire <= Date.now()) {
        this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return callback(null, null);
      }

      callback(null, JSON.parse(row.sess));
    } catch (fehler) {
      callback(fehler);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      this.db
        .prepare(
          `INSERT INTO sessions (sid, sess, expire, user_id) VALUES (?, ?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire, user_id = excluded.user_id`,
        )
        .run(sid, JSON.stringify(session), this.ablaufZeitpunkt(session), userIdAus(session));
      callback?.(null);
    } catch (fehler) {
      callback?.(fehler);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (fehler) {
      callback?.(fehler);
    }
  }

  touch(sid: string, session: SessionData, callback?: () => void): void {
    try {
      this.db
        .prepare('UPDATE sessions SET expire = ? WHERE sid = ?')
        .run(this.ablaufZeitpunkt(session), sid);
    } catch {
      // Ein misslungenes Verlaengern darf die Anfrage nicht scheitern lassen.
    }
    callback?.();
  }

  /**
   * Beendet alle Sitzungen einer Person und liefert deren Kennungen zurueck —
   * der Aufrufer braucht sie, um zugehoerige Socket-Verbindungen zu trennen.
   *
   * `except` nimmt eine Sitzung aus: Wer sein Passwort aendert, soll sich nicht
   * selbst aussperren.
   */
  destroyByUser(userId: string, options: { except?: string } = {}): string[] {
    const betroffen = this.db
      .prepare(
        `SELECT sid FROM sessions WHERE user_id = ?${options.except ? ' AND sid <> ?' : ''}`,
      )
      .all(...(options.except ? [userId, options.except] : [userId])) as { sid: string }[];

    const sids = betroffen.map((z) => z.sid);
    if (sids.length > 0) {
      this.db
        .prepare(`DELETE FROM sessions WHERE sid IN (${sids.map(() => '?').join(', ')})`)
        .run(...sids);
    }
    return sids;
  }

  /** Abgelaufene Sitzungen wegraeumen. Laeuft beim Start, nicht auf einem Timer. */
  pruneExpired(): void {
    this.db.prepare('DELETE FROM sessions WHERE expire <= ?').run(Date.now());
  }

  private ablaufZeitpunkt(session: SessionData): number {
    const maxAge = session.cookie?.maxAge;
    // Ohne maxAge waere die Sitzung ein Browser-Sitzungscookie. Der Server legt
    // dann eine grosszuegige Frist an, statt sie stillschweigend auf einen Tag
    // zu setzen — daran ist das verworfene Fertigpaket gescheitert.
    return Date.now() + (typeof maxAge === 'number' ? maxAge : 365 * 24 * 60 * 60 * 1000);
  }
}

function userIdAus(session: SessionData): string | null {
  const userId = (session as { userId?: unknown }).userId;
  return typeof userId === 'string' ? userId : null;
}
