import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

export interface SessionSecret {
  secret: string;
  source: 'env' | 'datei' | 'erzeugt';
}

/**
 * Ermittelt das Geheimnis, mit dem `express-session` die Sitzungskennung im
 * Cookie signiert.
 *
 * Entscheidend ist, dass es **dauerhaft** ist: Ein bei jedem Start neu
 * erzeugtes Geheimnis wuerde nach jedem Neustart alle Angemeldeten aussperren
 * — und damit genau die Zusage brechen, dass eine Anmeldung einen Neustart
 * uebersteht.
 *
 * Bevorzugt wird `SESSION_SECRET`. Fehlt die Variable, legt der Server ein
 * Geheimnis neben der Datenbank ab, statt stillschweigend ein fluechtiges zu
 * verwenden.
 */
export function resolveSessionSecret(datei: string, ausUmgebung: string | undefined): SessionSecret {
  if (ausUmgebung && ausUmgebung.trim() !== '') {
    return { secret: ausUmgebung, source: 'env' };
  }

  if (fs.existsSync(datei)) {
    const inhalt = fs.readFileSync(datei, 'utf-8').trim();
    // Eine leere Datei — etwa nach einem abgebrochenen Schreibvorgang — waere
    // schlimmer als keine: Sie wuerde zu einem leeren Geheimnis fuehren.
    if (inhalt !== '') return { secret: inhalt, source: 'datei' };
  }

  const secret = randomBytes(48).toString('base64url');
  fs.writeFileSync(datei, `${secret}\n`, { encoding: 'utf-8', mode: 0o600 });
  return { secret, source: 'erzeugt' };
}
