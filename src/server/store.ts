import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { VORGABE_VORLAUF_TAGE } from '../sperrfrist';
import type { MonthlyComment, Role, Settings, User, Wish } from '../types';

export interface NewWish {
  userId: string;
  date: string;
  shiftType: string;
  comment: string;
}

export interface NewMonthlyComment {
  userId: string;
  month: string;
  text: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

/**
 * Der gesamte Datenzugriff an einer Stelle.
 *
 * Die Datenbank schreibt `user_id`/`shift_type`, die Oberflaeche liest
 * `userId`/`shiftType`. Diese Uebersetzung passiert ausschliesslich hier —
 * faellt sie aus, bleibt der Kalender leer, ohne zu klagen.
 */
export interface Store {
  listWishes(): Wish[];
  findWish(id: string): Wish | undefined;
  addWish(wish: NewWish): Wish;
  deleteWish(id: string): void;

  listMonthlyComments(): MonthlyComment[];
  saveMonthlyComment(comment: NewMonthlyComment): MonthlyComment;

  listUsers(): User[];
  findUserById(id: string): User | undefined;
  findUserByName(name: string): UserWithHash | undefined;
  findUserWithHash(id: string): UserWithHash | undefined;
  createUser(input: { name: string; role: Role; passwordHash: string }): User;
  updateUser(id: string, changes: { name?: string; role?: Role }): boolean;
  setPasswordHash(id: string, passwordHash: string): boolean;
  deleteUser(id: string): boolean;

  getSettings(): Settings;
  setVorlaufTage(tage: number): Settings;
  setStichtag(monat: string, datum: string): Settings;
  loescheStichtag(monat: string): Settings;
}

export function createStore(db: Database): Store {
  const toWish = (row: any): Wish => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    shiftType: row.shift_type,
    comment: row.comment,
  });

  const toComment = (row: any): MonthlyComment => ({
    id: row.id,
    userId: row.user_id,
    month: row.month,
    text: row.text,
  });

  const toUser = (row: any): User => ({ id: row.id, name: row.name, role: row.role });

  const toUserWithHash = (row: any): UserWithHash => ({
    ...toUser(row),
    passwordHash: row.password_hash,
  });

  return {
    listWishes() {
      return db.prepare('SELECT * FROM wishes').all().map(toWish);
    },

    findWish(id) {
      const row = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
      return row ? toWish(row) : undefined;
    },

    addWish(wish) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO wishes (id, user_id, date, shift_type, comment) VALUES (?, ?, ?, ?, ?)',
      ).run(id, wish.userId, wish.date, wish.shiftType, wish.comment ?? '');
      return { id, userId: wish.userId, date: wish.date, shiftType: wish.shiftType as any, comment: wish.comment ?? '' };
    },

    deleteWish(id) {
      db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    },

    listMonthlyComments() {
      return db.prepare('SELECT * FROM monthly_comments').all().map(toComment);
    },

    saveMonthlyComment(comment) {
      const vorhanden: any = db
        .prepare('SELECT id FROM monthly_comments WHERE user_id = ? AND month = ?')
        .get(comment.userId, comment.month);

      if (vorhanden) {
        db.prepare('UPDATE monthly_comments SET text = ? WHERE id = ?').run(
          comment.text,
          vorhanden.id,
        );
        return { id: vorhanden.id, ...comment };
      }

      const id = randomUUID();
      db.prepare(
        'INSERT INTO monthly_comments (id, user_id, month, text) VALUES (?, ?, ?, ?)',
      ).run(id, comment.userId, comment.month, comment.text);
      return { id, ...comment };
    },

    listUsers() {
      return db.prepare('SELECT id, name, role FROM users ORDER BY name').all().map(toUser);
    },

    findUserById(id) {
      const row = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(id);
      return row ? toUser(row) : undefined;
    },

    findUserByName(name) {
      // Dieselbe Vergleichsregel wie Migration und Unique-Index: exakt nach Trim.
      const row = db.prepare('SELECT * FROM users WHERE name = ?').get(name.trim());
      return row ? toUserWithHash(row) : undefined;
    },

    findUserWithHash(id) {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return row ? toUserWithHash(row) : undefined;
    },

    createUser({ name, role, passwordHash }) {
      const id = randomUUID();
      db.prepare('INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)').run(
        id,
        name.trim(),
        role,
        passwordHash,
      );
      return { id, name: name.trim(), role };
    },

    updateUser(id, changes) {
      const felder: string[] = [];
      const werte: unknown[] = [];
      if (changes.name !== undefined) {
        felder.push('name = ?');
        werte.push(changes.name.trim());
      }
      if (changes.role !== undefined) {
        felder.push('role = ?');
        werte.push(changes.role);
      }
      if (felder.length === 0) return true;

      const ergebnis = db
        .prepare(`UPDATE users SET ${felder.join(', ')} WHERE id = ?`)
        .run(...werte, id);
      return ergebnis.changes > 0;
    },

    setPasswordHash(id, passwordHash) {
      const ergebnis = db
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(passwordHash, id);
      return ergebnis.changes > 0;
    },

    deleteUser(id) {
      // Wuensche und Hinweise verschwinden per ON DELETE CASCADE mit.
      const ergebnis = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return ergebnis.changes > 0;
    },

    getSettings() {
      const row: any = db.prepare("SELECT value FROM settings WHERE key = 'vorlaufTage'").get();
      const zeilen: any[] = db.prepare('SELECT monat, datum FROM stichtage').all();

      const stichtage: Record<string, string> = {};
      for (const zeile of zeilen) stichtage[zeile.monat] = zeile.datum;

      return {
        vorlaufTage: row ? Number(row.value) : VORGABE_VORLAUF_TAGE,
        stichtage,
      };
    },

    setVorlaufTage(tage) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('vorlaufTage', ?)").run(
        String(tage),
      );
      return this.getSettings();
    },

    setStichtag(monat, datum) {
      // Ein Monat, eine Zeile: Ein zweites Setzen ersetzt das erste, statt eine
      // zweite Wahrheit daneben zu legen.
      db.prepare('INSERT OR REPLACE INTO stichtage (monat, datum) VALUES (?, ?)').run(monat, datum);
      return this.getSettings();
    },

    loescheStichtag(monat) {
      // Der einzige Weg zurueck zum automatischen Vorschlag.
      db.prepare('DELETE FROM stichtage WHERE monat = ?').run(monat);
      return this.getSettings();
    },
  };
}
