import { describe, expect, test } from 'vitest';
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from './passwords';

describe('hashPassword', () => {
  test('gibt das Passwort nicht im Klartext preis', async () => {
    const hash = await hashPassword('geheimes-passwort');

    expect(hash).not.toContain('geheimes-passwort');
  });

  test('erzeugt fuer dasselbe Passwort zwei verschiedene Hashes', async () => {
    const [a, b] = await Promise.all([hashPassword('gleiches'), hashPassword('gleiches')]);

    expect(a).not.toBe(b);
  });

  test('weist ein zu kurzes Passwort ab', async () => {
    const zuKurz = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);

    await expect(hashPassword(zuKurz)).rejects.toThrow(/mindestens/i);
  });
});

describe('verifyPassword', () => {
  test('erkennt das richtige Passwort', async () => {
    const hash = await hashPassword('richtiges-passwort');

    expect(await verifyPassword(hash, 'richtiges-passwort')).toBe(true);
  });

  test('lehnt ein falsches Passwort ab', async () => {
    const hash = await hashPassword('richtiges-passwort');

    expect(await verifyPassword(hash, 'falsches-passwort')).toBe(false);
  });

  test('liefert false statt zu werfen, wenn der Hash unbrauchbar ist', async () => {
    // Kann bei einer von Hand bearbeiteten Datenbank vorkommen. Der Anmeldeweg
    // darf daran nicht mit einem Serverfehler zerbrechen.
    expect(await verifyPassword('kein-gueltiger-hash', 'egal')).toBe(false);
  });
});
