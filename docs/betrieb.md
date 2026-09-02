# Betrieb: Hosting, Erreichbarkeit und Sicherung

Entscheidungsvorlage fuer die Krankenhaus-IT. Stand: 2026-09-02.
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
8. **Container oder nackt?** Beide Wege sind vorbereitet (siehe „Wie man sie
   hinstellt"). Wenn im Haus ohnehin Container laufen, ist das der kuerzere Weg;
   ein schlichter Server tut es aber auch.

## Was die Anwendung braucht

- Node.js 22 oder neuer (oder einen Container-Laufzeitdienst, siehe unten).
- Einen Port, den der Proxy erreicht (`PORT`, Vorgabe 3000). Die Anwendung
  lauscht auf allen Adressen.
- Ein beschreibbares Verzeichnis fuer `data.sqlite` und `sitzungsgeheimnis`.

## Wie man sie hinstellt

Zwei Wege. Welcher passt, entscheidet, was im Haus ohnehin laeuft — die
Anwendung ist in beiden Faellen dieselbe.

### Weg A — Container

Das Repository enthaelt ein `Dockerfile`. Der CI-Auftrag `Container` baut das
Abbild bei jeder Aenderung, startet es und prueft am laufenden Behaelter, dass
die Oberflaeche antwortet und `/api/wishes` ohne Anmeldung mit 401 abgewiesen
wird.

```bash
docker build -t wunschkalender .
docker run -d --name wunschkalender   -p 3000:3000   -v /srv/wunschkalender:/daten   -e VERTRAUE_PROXY=1 -e HSTS=1   -e SESSION_SECRET='<langes Zufallsgeheimnis>'   wunschkalender
```

Der Datentraeger unter `/daten` ist **nicht** optional: Ohne ihn sind Konten und
Wuensche beim naechsten Neustart weg. Der Prozess laeuft im Behaelter nicht als
`root`.

### Weg B — Nackt auf einem Server

```bash
npm ci
npm run build
npm start          # setzt NODE_ENV=production
```

Dieselben Umgebungsvariablen. Ohne `DATEN_ORDNER` liegen die Dateien im
Arbeitsverzeichnis.

### Umgebungsvariablen

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port, auf dem die Anwendung lauscht |
| `DATEN_ORDNER` | Arbeitsverzeichnis | Wo `data.sqlite` und `sitzungsgeheimnis` liegen. Im Abbild `/daten` |
| `VERTRAUE_PROXY` | `0` | Anzahl der Reverse Proxys davor. `0` heisst: keiner |
| `HSTS` | aus | `1` setzt `Strict-Transport-Security` |
| `SESSION_SECRET` | wird erzeugt | Sitzungsgeheimnis; ohne Angabe legt die Anwendung `sitzungsgeheimnis` an |
| `BEISPIELDATEN` | aus | Testfassung mit erfundenen Daten. **Im Echtbetrieb ungesetzt lassen** |

**`BEISPIELDATEN` bleibt im Echtbetrieb ungesetzt.** Der Schalter legt Konten
mit einem Passwort an, das auf der Anmeldeseite steht. Er greift nur auf einer
leeren Datenbank: Findet er Konten vor, die nicht aus dem Beispielmodus
stammen, verweigert die Anwendung den Start, statt sich ueber eine echte
Aufstellung zu legen.

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

## Die Testfassung zum Ansehen

Damit man die Anwendung zeigen kann, bevor irgendetwas entschieden ist, laeuft
eine Testfassung ausserhalb des Hauses — bei Render, aus demselben
`Dockerfile`, eingerichtet ueber die `render.yaml` im Repository.

- **Erfundene Daten.** Fuenf ausgedachte Konten, ausgedachte Wuensche. Keine
  Namen echter Kolleginnen, auch nicht abgewandelt.
- **Ohne dauerhaften Speicher.** Bei jedem Neustart beginnt sie von vorn. Wer
  darin herumprobiert, richtet keinen Schaden an.
- Ein Streifen ueber der Anwendung sagt durchgehend, dass es die Testfassung
  ist.
- Der kostenlose Tarif schlaeft nach 15 Minuten ohne Zugriff ein; der erste
  Aufruf danach dauert etwa eine Minute.

Adresse: _(nach der Einrichtung eintragen)_

Mit dem Produktivbetrieb hat das nichts zu tun. Die Entscheidung oben bleibt
davon unberuehrt.

## Unabhaengig von der Entscheidung

Die Absicherung in der Anwendung bleibt in beiden Faellen erforderlich. Ein VPN
ist eine Mauer davor, kein Ersatz fuer ein Schloss an der Tuer: Auch innerhalb
des Netzes darf nicht jeder alles duerfen, und aendert sich die Erreichbarkeit
spaeter, darf die Anwendung dabei nicht auseinanderfallen.

Vorhanden sind: Anmeldung mit Passwort-Hashes (Argon2), serverseitige Sitzungen
mit Widerruf, Rollen- und Eigentumspruefung an jedem Endpunkt, Begrenzung der
Anmeldeversuche, strenge Pruefung aller eingehenden Daten.
