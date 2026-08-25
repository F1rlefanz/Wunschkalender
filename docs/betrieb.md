# Betrieb: Hosting, Erreichbarkeit und Sicherung

Entscheidungsvorlage fuer die Krankenhaus-IT. Stand: 2026-08-20.
Zugehoeriges Issue: [#8](https://github.com/F1rlefanz/Wunschkalender/issues/8).

Dieses Dokument haelt fest, was die Anwendung fuer den Betrieb braucht, welche
Entscheidung ansteht und was danach einzutragen ist. Die Entscheidung selbst
trifft die IT, nicht die Entwicklung.

## Was die Anwendung ist

Ein Dienstwunsch-Kalender fuer eine Pflegestation: Mitarbeitende tragen ihre
Schichtwuensche ein, die Stationsleitung sieht alle Wuensche und exportiert den
Monat als PDF.

- **Keine Patientendaten.** Enthalten sind Namen der Mitarbeitenden,
  Schichtwuensche und Monatshinweise.
- Ein Node.js-Prozess (Express) mit einer SQLite-Datei daneben. Keine externe
  Datenbank, kein weiterer Dienst.
- Anmeldung mit Benutzername und Passwort (Argon2), Sitzungen serverseitig.
  Zwei Rollen: Mitarbeitende und Stationsleitung.

Das Risiko ist damit nicht der Inhalt, sondern die Anwendung als moeglicher Weg
in das Krankenhausnetz.

## Die Entscheidung

Beide Wege schliessen sich aus.

### Weg 1 — Veroeffentlichung ueber HTTPS

Erreichbar aus dem Internet, hinter einem Reverse Proxy mit gueltigem
Zertifikat.

- **Dafuer:** Der Zugriff erfolgt ueberwiegend von zuhause, von privaten
  Geraeten. Das ist der einzige Weg, der dort ohne Zutun der Pflegekraefte
  funktioniert.
- **Dagegen:** Die Anwendung steht im Internet und braucht entsprechend
  Aufmerksamkeit — Zertifikat, Aktualisierungen, Protokollierung.

### Weg 2 — Nur ueber VPN

- **Dafuer:** Nach aussen nicht sichtbar.
- **Dagegen:** Jede Pflegekraft braucht einen VPN-Zugang auf dem privaten
  Geraet. Erfahrungsgemaess ist das der Hauptgrund, warum solche Anwendungen
  dann doch nicht benutzt werden.

### Entschieden wurde

> _(von der IT auszufuellen — Weg, Datum, wer entschieden hat)_

## Fragen an die IT

1. **Weg 1 oder Weg 2?** Siehe oben.
2. **Ansprechpartner:** Wer in der IT betreut die Anwendung — Name, Erreichbarkeit?
3. **Adresse:** Unter welchem Namen ist die Anwendung erreichbar? Die Adresse
   muss feststehen, bevor die Anmeldung ueber ein Microsoft-Dienstkonto
   eingerichtet werden kann (Rueckleit-Adresse, Issue #6).
4. **Reverse Proxy:** Wie viele Proxys stehen vor der Anwendung? Die Zahl wird
   gebraucht, nicht nur das "ja" (siehe `VERTRAUE_PROXY` unten).
5. **Zertifikat:** Wer stellt es aus, wer erneuert es?
6. **Sicherung:** Wer sichert die Datenbankdatei, wohin und wie oft? Siehe
   naechster Abschnitt — die Datei laesst sich nicht einfach im laufenden
   Betrieb kopieren.
7. **Aktualisierungen:** Wer spielt neue Fassungen ein?

## Was die Anwendung braucht

- Node.js 20 oder neuer.
- Einen Port, den der Proxy erreicht (`PORT`, Vorgabe 3000). Die Anwendung
  lauscht auf allen Adressen.
- Ein beschreibbares Verzeichnis fuer `data.sqlite` und `sitzungsgeheimnis`.
- Start im Produktivbetrieb: `npm run build`, dann `npm start`
  (setzt `NODE_ENV=production`).

### Umgebungsvariablen

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port, auf dem die Anwendung lauscht |
| `VERTRAUE_PROXY` | `0` | Anzahl der Reverse Proxys davor. `0` heisst: keiner |
| `HSTS` | aus | `1` setzt `Strict-Transport-Security` |
| `SESSION_SECRET` | wird erzeugt | Sitzungsgeheimnis; ohne Angabe legt die Anwendung `sitzungsgeheimnis` an |

**`VERTRAUE_PROXY` muss zur tatsaechlichen Aufstellung passen.** Steht ein Proxy
davor, der HTTPS beendet, meldet er die urspruengliche Verbindung ueber
`X-Forwarded-Proto`; nur dann setzt die Anwendung das Sitzungscookie als
`Secure`. Steht *kein* Proxy davor, darf dieser Angabe nicht geglaubt werden —
sonst faelscht sie jeder Aufrufer selbst. Deshalb ist die Vorgabe `0`, und die
Anwendung warnt beim Start, wenn die Kombination nicht zusammenpasst.

**`HSTS` nur beim Veroeffentlichungsweg.** Der Header weist Browser an, die
Adresse fuer ein Jahr ausschliesslich verschluesselt aufzurufen. In einem reinen
HTTP-Betrieb im VPN macht das die Anwendung fuer die betroffenen Browser
unerreichbar — und zwar auch dann noch, wenn der Header laengst wieder weg ist.

Fuer Weg 1 gilt also: `VERTRAUE_PROXY=1` (oder die tatsaechliche Zahl) **und**
`HSTS=1`. Fuer Weg 2: beide Vorgaben unveraendert lassen.

## Sicherung der Datenbank

Die Daten liegen in `data.sqlite`. Im laufenden Betrieb gehoeren
`data.sqlite-wal` und `data.sqlite-shm` dazu (WAL-Modus) — wird nur die
Hauptdatei kopiert, fehlen die zuletzt geschriebenen Wuensche.

Zwei brauchbare Wege:

- **Alle drei Dateien zusammen sichern**, oder
- **`sqlite3 data.sqlite ".backup sicherung.sqlite"`** — erzeugt eine in sich
  stimmige Kopie, auch waehrend die Anwendung laeuft. Der empfohlene Weg.

Die Sicherung enthaelt Benutzerkonten mit Passwort-Hashes und gehoert
entsprechend behandelt. `sitzungsgeheimnis` ebenfalls sichern: Geht die Datei
verloren, sind alle Angemeldeten abgemeldet — mehr nicht, aber es faellt auf.

Aufbewahrung, Ort und Haeufigkeit legt die IT fest.

## Unabhaengig von der Entscheidung

Die Absicherung in der Anwendung bleibt in beiden Faellen erforderlich. Ein VPN
ist eine Mauer davor, kein Ersatz fuer ein Schloss an der Tuer: Auch innerhalb
des Netzes darf nicht jeder alles duerfen, und aendert sich die Erreichbarkeit
spaeter, darf die Anwendung dabei nicht auseinanderfallen.

Vorhanden sind: Anmeldung mit Passwort-Hashes (Argon2), serverseitige Sitzungen
mit Widerruf, Rollen- und Eigentumspruefung an jedem Endpunkt, Begrenzung der
Anmeldeversuche, strenge Pruefung aller eingehenden Daten.
