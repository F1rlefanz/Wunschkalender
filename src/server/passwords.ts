import { hash, verify } from '@node-rs/argon2';

// Die Zahl steht in src/types.ts, damit Server und Oberflaeche dieselbe nennen.
export { MIN_PASSWORD_LENGTH } from '../types';
import { MIN_PASSWORD_LENGTH } from '../types';

export async function hashPassword(
  password: string,
  options: { skipLengthCheck?: boolean } = {},
): Promise<string> {
  // `skipLengthCheck` gilt ausschliesslich der Migration von Bestandsdaten:
  // Alt-Passwoerter duerfen nicht an einer Regel scheitern, die es zum
  // Zeitpunkt ihrer Entstehung noch nicht gab.
  if (!options.skipLengthCheck && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  }
  return hash(password);
}

/**
 * Prueft ein Passwort gegen einen Hash.
 *
 * Ein unbrauchbarer Hash — etwa aus einer von Hand bearbeiteten Datenbank —
 * fuehrt zu `false`, nicht zu einer Ausnahme: Die Anmeldung soll fehlschlagen,
 * nicht der Server.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
