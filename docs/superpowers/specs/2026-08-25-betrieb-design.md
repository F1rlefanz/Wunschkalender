# Betrieb: Testfassung zeigen, Uebergabe vorbereiten

Stand 2026-08-25. Zugehoeriges Issue: [#8](https://github.com/F1rlefanz/Wunschkalender/issues/8).

Zwei Ziele, ein Fundament. Die Anwendung soll **jetzt** irgendwo laufen, damit man
sie herzeigen kann — und sie soll so verpackt sein, dass die Krankenhaus-IT sie in
Minuten hinstellen kann, sobald sie entschieden hat.

## Was hier NICHT entschieden wird

Issue #8 haelt fest: Die Anwendung wird im Krankenhaus gehostet, und ob sie ueber
HTTPS veroeffentlicht oder nur ueber VPN erreichbar ist, **entscheidet die IT**,
nicht die Entwicklung. `docs/betrieb.md` ist die Vorlage dafuer und wartet auf
einen Ansprechpartner.

Dieser Entwurf greift dem nicht vor. Er baut nur das, was in **beiden** Faellen
gebraucht wird — und daneben eine Testfassung mit erfundenen Daten, die mit dem
spaeteren Produktivbetrieb nichts zu tun hat.

## Das Fundament: ein Container-Abbild

Ein `Dockerfile` in zwei Stufen. Die Bau-Stufe holt die Abhaengigkeiten und baut
Client und Server; die Laufzeit-Stufe traegt nur das Ergebnis.

Zwei Dinge, die hier leicht schiefgehen und deshalb festgelegt gehoeren:

- **`better-sqlite3` und `@node-rs/argon2` sind native Module.** Ihre gebauten
  Binaerdateien passen nur zu derselben Node-Fassung und derselben C-Bibliothek.
  Beide Stufen benutzen deshalb dieselbe Debian-Grundlage (`node:24-bookworm`
  zum Bauen, `node:24-bookworm-slim` zur Laufzeit), und die Laufzeit-Stufe
  **kopiert** `node_modules` aus der Bau-Stufe, statt neu zu installieren.
- **Der Prozess laeuft nicht als `root`.** Das ist im Krankenhausnetz kein
  Schmuck, sondern die Erwartung.

### Eine Codeaenderung ist noetig

`server.ts` verankert heute drei Pfade fest im Arbeitsverzeichnis:

```ts
const DB_FILE = path.join(process.cwd(), 'data.sqlite');
const LEGACY_JSON = path.join(process.cwd(), 'db.json');
const SECRET_FILE = path.join(process.cwd(), 'sitzungsgeheimnis');
```

In einem Container liegt der Code an einer Stelle und die Daten an einer anderen —
sonst sind sie beim naechsten Start weg. Es kommt eine Umgebungsvariable
`DATEN_ORDNER` dazu; ohne sie bleibt alles wie bisher (Arbeitsverzeichnis), damit
sich fuer die Entwicklung nichts aendert. Das ist die einzige Aenderung am
Anwendungscode in diesem Vorhaben.

### Der Beweis, dass es laeuft

Docker ist auf dem Rechner des Betreibers nicht installiert; das Abbild kann hier
weder gebaut noch ausprobiert werden. Deshalb baut es die CI: ein neuer Auftrag
`Container` baut das Abbild, startet es, und prueft zwei Dinge am laufenden
Behaelter:

- `GET /` antwortet mit 200 (die Oberflaeche wird ausgeliefert),
- `GET /api/wishes` ohne Sitzung antwortet mit 401 (die Absicherung ist im
  Abbild wirklich drin).

Erst dieser Auftrag macht aus dem `Dockerfile` etwas, das nachweislich tut, was
draufsteht. Ein Abbild, das nie gestartet wurde, ist eine Behauptung.

Einen Health-Endpunkt gibt es noch nicht (Issue
[#4](https://github.com/F1rlefanz/Wunschkalender/issues/4)); die Rauchprobe und
der `HEALTHCHECK` im Abbild fragen deshalb `/` ab. Sobald es ihn gibt, wird beides
darauf umgestellt.

## Die Testfassung

### Beispielmodus

Damit man die Anwendung herzeigen kann, muss man sich anmelden koennen — und die
Zugangsdaten muessen auf der Anmeldeseite stehen. Ein Modus mit bekannten
Passwoertern ist aber eine Hintertuer, wenn er je im Echtbetrieb anspringt.
Deshalb **zwei** Sicherungen, die beide greifen muessen:

1. Er laeuft nur, wenn `BEISPIELDATEN=an` ausdruecklich gesetzt ist.
2. Er **verweigert den Start**, wenn die Datenbank bereits Konten enthaelt, die
   nicht aus dem Beispielmodus stammen. Lieber steht die Testfassung still, als
   dass sie sich ueber eine echte Aufstellung legt.

Was er anlegt: eine Stationsleitung und vier Pflegekraefte mit erfundenen Namen,
verteilte Schichtwuensche ueber den laufenden und die beiden folgenden Monate,
zwei Monatshinweise. Die Namen sind erkennbar erfunden — keine Namen echter
Kolleginnen, auch nicht abgewandelt.

Dazu ein Hinweisstreifen ueber der Anwendung: **„Testfassung mit erfundenen Daten"**.
Er ist an denselben Schalter gebunden und verschwindet mit ihm.

### Wo sie laeuft

**Render**, kostenloser Tarif, ueber eine `render.yaml` im Repository: Der
Betreiber meldet sich mit seinem GitHub-Konto an, waehlt „New Blueprint" und ist
fertig. Render baut aus demselben `Dockerfile`.

Festzuhalten, weil beides sonst Zeit kostet:

- **`VERTRAUE_PROXY=1` ist Pflicht.** Render beendet TLS davor. Ohne diesen Wert
  glaubt Express der Weiterleitung nicht, und das Sitzungscookie geht ohne
  `Secure` hinaus — genau der Fall, den `src/server/betriebsmodus.ts` beschreibt.
- **Kein dauerhafter Datentraeger**, und das ist hier richtig: Die Testfassung
  soll bei jedem Neustart mit frischen Beispieldaten beginnen. Wer darin
  herumprobiert, richtet keinen Schaden an.
- Der kostenlose Tarif schlaeft nach 15 Minuten ohne Zugriff ein; der erste
  Aufruf danach dauert etwa eine Minute. Fuer eine Testfassung hinnehmbar.
- Socket.IO braucht WebSockets. Render kann das.

## Die Uebergabe

`docs/betrieb.md` wird um einen Abschnitt **„Wie man sie hinstellt"** ergaenzt.
Zwei Wege, weil unbekannt ist, was im Haus laeuft — viele Krankenhaus-IT-Abteilungen
fahren schlichte Server ohne Container:

| Weg | Was zu tun ist |
|---|---|
| Container | `docker run` mit dem Abbild, ein Datentraeger fuer `DATEN_ORDNER`, die Umgebungsvariablen aus der Tabelle |
| Nackt | Node 22 oder neuer, `npm ci`, `npm run build`, `npm start`, dieselben Umgebungsvariablen |

Dazu eine Tabelle aller Umgebungsvariablen mit Vorgabe und Bedeutung
(`PORT`, `SESSION_SECRET`, `DATEN_ORDNER`, `VERTRAUE_PROXY`, `HSTS`,
`BEISPIELDATEN`), und ausdruecklich: **`BEISPIELDATEN` bleibt im Echtbetrieb
ungesetzt.**

Und die Fragen, die die IT beantworten muss, damit der Betreiber weiss, was er
fragen soll: Container oder nackt? Welcher Name/welche Adresse? Wer sichert die
Datenbankdatei, wohin, wie oft? Wer ist Ansprechpartner? Das letzte ist ein
offenes Akzeptanzkriterium in Issue #8.

## Was ausdruecklich nicht gebaut wird

- **Kein Health-Endpunkt, keine Protokollierung** — das ist Issue #4 und eine
  eigene Sache.
- **Keine Produktivaufstellung.** Die entscheidet die IT (Issue #8).
- **Keine dauerhafte Speicherung auf Render.** Die Testfassung darf zuruecksetzen.
- **Keine Anmeldung ueber Microsoft** (Issue
  [#6](https://github.com/F1rlefanz/Wunschkalender/issues/6)) — sie setzt die
  endgueltige Adresse voraus, die es noch nicht gibt.

## Reihenfolge

1. `DATEN_ORDNER` in `server.ts`, mit Test.
2. `Dockerfile` und der CI-Auftrag `Container` — ab hier ist belegt, dass das
   Abbild laeuft.
3. Beispielmodus samt beider Sicherungen, mit Tests fuer den Verweigerungsfall.
4. `render.yaml`, dann die Testfassung tatsaechlich starten und die Adresse
   festhalten.
5. `docs/betrieb.md` ergaenzen und Issue #8 um den erreichten Stand fortschreiben.

Schritt 4 braucht eine Anmeldung bei Render — die kann nur der Betreiber machen.
Bis dahin ist alles andere fertig und geprueft.
