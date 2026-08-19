import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSessionSecret } from './session-secret';

let dir: string;
let datei: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-secret-'));
  datei = path.join(dir, 'sitzungsgeheimnis');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('resolveSessionSecret', () => {
  test('nimmt die Umgebungsvariable, wenn sie gesetzt ist', () => {
    const ergebnis = resolveSessionSecret(datei, 'aus-der-umgebung');

    expect(ergebnis.secret).toBe('aus-der-umgebung');
    expect(ergebnis.source).toBe('env');
    expect(fs.existsSync(datei)).toBe(false);
  });

  test('erzeugt eines und legt es ab, wenn nichts vorhanden ist', () => {
    const ergebnis = resolveSessionSecret(datei, undefined);

    expect(ergebnis.source).toBe('erzeugt');
    expect(ergebnis.secret.length).toBeGreaterThanOrEqual(32);
    expect(fs.readFileSync(datei, 'utf-8').trim()).toBe(ergebnis.secret);
  });

  test('liefert beim naechsten Start dasselbe Geheimnis', () => {
    // Andernfalls waeren nach jedem Neustart alle Angemeldeten ausgesperrt —
    // und die Zusage "die Anmeldung uebersteht einen Neustart" gebrochen.
    const ersterStart = resolveSessionSecret(datei, undefined);
    const zweiterStart = resolveSessionSecret(datei, undefined);

    expect(zweiterStart.secret).toBe(ersterStart.secret);
    expect(zweiterStart.source).toBe('datei');
  });

  test('erzeugt bei jedem frischen Ablageort ein anderes Geheimnis', () => {
    const a = resolveSessionSecret(path.join(dir, 'a'), undefined);
    const b = resolveSessionSecret(path.join(dir, 'b'), undefined);

    expect(a.secret).not.toBe(b.secret);
  });

  test('ersetzt eine leere Ablagedatei, statt mit leerem Geheimnis zu laufen', () => {
    fs.writeFileSync(datei, '   \n', 'utf-8');

    const ergebnis = resolveSessionSecret(datei, undefined);

    expect(ergebnis.secret.trim().length).toBeGreaterThanOrEqual(32);
    expect(ergebnis.source).toBe('erzeugt');
  });
});
