/**
 * Wie die Anwendung erreichbar ist, entscheidet der Betrieb — nicht der Code.
 * Siehe `docs/betrieb.md`. Diese Datei uebersetzt die Umgebung in die beiden
 * Schalter, die der Server dafuer braucht, und sagt, wenn die Kombination
 * nicht zusammenpasst.
 */
export interface Betriebsmodus {
  /**
   * Anzahl vertrauenswuerdiger Proxys vor der Anwendung. `0` heisst: kein
   * Proxy. Das ist die sichere Vorgabe — wer ohne Proxy `X-Forwarded-Proto`
   * glaubt, laesst sich von jedem Aufrufer eine verschluesselte Verbindung
   * vortaeuschen, und das Sitzungscookie ginge trotz `secure: 'auto'` ohne
   * `Secure` hinaus.
   */
  proxyHops: number;
  /**
   * Ob `Strict-Transport-Security` gesetzt wird. Ausdruecklicher Schalter,
   * keine Automatik: Im reinen VPN-Betrieb ueber HTTP wuerde HSTS die
   * Anwendung fuer Monate unerreichbar machen.
   */
  hsts: boolean;
  /** Auffaellige Kombination, die beim Start gemeldet wird — sonst `null`. */
  warnung: string | null;
}

/** Liest eine Zahl >= 0; alles andere gilt als nicht gesetzt. */
function leseHops(wert: string | undefined): number {
  if (!wert) return 0;
  if (!/^\d+$/.test(wert.trim())) return 0;
  return Number(wert.trim());
}

/** Ausdrueckliche Zustimmung, in beiden ueblichen Schreibweisen. */
function leseSchalter(wert: string | undefined): boolean {
  const norm = (wert ?? '').trim().toLowerCase();
  return norm === '1' || norm === 'an' || norm === 'true' || norm === 'ja';
}

export function leseBetriebsmodus(env: Record<string, string | undefined>): Betriebsmodus {
  const proxyHops = leseHops(env.VERTRAUE_PROXY);
  const hsts = leseSchalter(env.HSTS);
  const produktiv = env.NODE_ENV === 'production';

  let warnung: string | null = null;
  if (produktiv && proxyHops === 0 && !hsts) {
    warnung =
      'Weder VERTRAUE_PROXY noch HSTS gesetzt: Die Anwendung wird als unverschluesselt ' +
      'erreichbar angenommen, das Sitzungscookie geht ohne Secure hinaus. Fuer den ' +
      'Betrieb hinter einem HTTPS-Proxy VERTRAUE_PROXY und HSTS setzen (docs/betrieb.md).';
  } else if (produktiv && hsts && proxyHops === 0) {
    warnung =
      'HSTS ist gesetzt, aber kein Proxy wird vertraut (VERTRAUE_PROXY=0). Dann erkennt ' +
      'Express die HTTPS-Verbindung nicht und das Sitzungscookie bleibt ohne Secure.';
  }

  return { proxyHops, hsts, warnung };
}
