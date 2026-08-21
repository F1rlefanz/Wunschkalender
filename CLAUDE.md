# Wunschkalender

Dienstwunsch-Kalender fuer eine Pflegestation. Mitarbeitende tragen Schichtwuensche
(`Früh`, `Spät`, `Nacht`, `Frei`) je Tag ein; die Stationsleitung sieht alle Wuensche
und exportiert den Monat als PDF fuer die Dienstplanung.

Die Anwendung ist ein **Kommunikationsmittel, keine Regeldurchsetzung**: Sie sammelt
Wuensche und stellt sie lesbar dar. Wer wie viele Wuensche hat und wie sie verrechnet
werden, entscheidet die Stationsleitung beim Schreiben des Plans. Bewertende Merkmale
— „zu viele Frei-Wuensche an diesem Tag" — gehoeren deshalb nicht hinein (#4).

Zwei Rollen, im Code `'Employee'` und `'Manager'`: Mitarbeitende sehen nur die eigenen
Wuensche, die Leitung sieht alle und verwaltet Benutzer.

## Wo was steht

| Frage | Antwort steht in |
|---|---|
| Was ist offen und warum? | **GitHub Issues** (`gh issue list`) — nicht in Dateien im Repo |
| Was hat sich fuer Nutzer geaendert? | `CHANGELOG.md` |
| Wie funktioniert die Codebasis? | diese Datei |
| Wo laeuft das, wer sichert? | `docs/betrieb.md` (Vorlage fuer die IT, Issue #30) |
| Wie sieht es aus, und warum so? | `docs/gestaltung.md` |
| Wie wird hier gearbeitet? | `.claude/skills/` |

Diese Datei liegt in **jeder** Nachricht im Kontext. Deshalb gilt ein Zeichenbudget, das
`tools/pruefe-schleuse.mjs` prueft. Wenn es reisst: auslagern, nicht die Schwelle anheben.

## Befehle

```bash
npm install
npm run dev      # Express + Vite im Middleware-Modus, http://localhost:3000
npm run lint     # tsc --noEmit
npm test         # vitest
npm run build    # Client nach dist/, Server nach dist/server.cjs
```

## Aufbau

Ein Prozess bedient beides: `server.ts` ist ein Express-Server, der im Entwicklungsmodus
Vite als Middleware einhaengt und im Produktionsmodus `dist/` statisch ausliefert.

- `server.ts` — REST unter `/api/*` und Socket.IO, sonst nichts. Der Datenzugriff liegt
  in `src/server/store.ts`, damit er testbar ist.
- `src/server/` — Serverbausteine mit Tests: `database` (Schema), `store` (Datenzugriff),
  `migration` (einmalig aus `db.json`), `passwords` (Argon2), `session-store`,
  `session-secret`, `seed` (Leitungskonto beim Erststart).
- `src/App.tsx` — haelt den gesamten Anwendungszustand und die Socket-Verbindung.
  Schreiben laeuft ueber `src/api/client.ts` (REST); die Antwort wird **nicht** in den
  State geschrieben — die Aktualisierung kommt ueber das Socket-Ereignis zurueck.
- `src/components/` — `Gatekeeper` (Anmeldung), `Header`, `Calendar` (Kernstueck, ~680 Zeilen),
  `UserManagement`, `Einstellungen` (Vorlauf des Vorschlags, nur Leitung), `Profile`. Der `Header` traegt
  vier Wege; ein fuenfter passt auf 360 px nicht mehr ohne Umbau. `Calendar` haelt drei Ansichten in einer Datei
  (`viewType`: `'grid' | 'list' | 'matrix'`); wer dort etwas aendert, prueft alle drei.
- `src/index.css` — die Gestaltungsgrundlage (#21): Farbrollen, fluide Skalen,
  Radien. **Die einzige Stelle mit Farbwerten**; Komponenten sprechen Rollen an
  (`bg-flaeche`, `text-leise`), nie `slate-`/`blue-`. `src/gestaltung.test.ts`
  rechnet die Kontraste bei jedem `npm test` nach. Umgestellt sind bisher
  `Header` und `Gatekeeper`; der Rest folgt mit #15, #16, #17 und #20.
- `src/types.ts` — gemeinsame Typen fuer Client und Server.
- `src/hinweise.ts` — welche Monatshinweise unter der Ueberschrift eines Monats
  stehen und wann ein eintreffendes Socket-Ereignis ein Eingabefeld ueberschreiben
  darf. Getipptes hat Vorrang, sonst geht es beim Schreiben anderer verloren.
- `src/export.ts` — welche Zeilen im PDF stehen. Reine Funktionen ohne jsPDF,
  damit der Inhalt des Exports ohne PDF pruefbar ist.
- `src/sperrfrist.ts` — wann ein Monat gesperrt ist. Jeder Monat hat **einen**
  wirksamen Stichtag: entweder einen, den die Leitung fuer diesen Monat gesetzt
  hat, oder den automatischen Vorschlag `Monatsanfang minus Vorlauf` (Vorgabe 56
  Tage). Offen ist ein Monat **bis einschliesslich** seinem Stichtag. Ein
  gesetzter Stichtag wird vom Vorschlag **nie** ueberschrieben, auch nicht bei
  geaendertem Vorlauf (#36) — er ist Rueckfallebene, keine laufende Korrektur.
  **Dass der laufende Monat gesperrt ist, folgt daraus** (#33): Sein Stichtag
  liegt Wochen zurueck; eine eigene Klausel dafuer gibt es nicht mehr. **Server
  und Oberflaeche benutzen dieselbe Funktion**; zwei Fassungen waeren ein Fehler.
  Wer die Sperre erweitert, prueft die Oberflaeche mit: Loeschknoepfe und das
  Hinweisfeld muessen verschwinden, sonst laufen sie in einen 403.
- `tools/` — Sessionstart- und Schleusen-Skript (in `.claude/settings.json` als Hooks).

## Fallstricke

- **`data.sqlite` und `sitzungsgeheimnis` gehoeren nie ins Repository.** Sie enthalten
  Benutzerkonten und Sitzungen. Beide sind in `.gitignore`, und die Schleuse prueft es
  zusaetzlich — samt `db.json*`, denn `db.json.migriert` traegt die alten Klartext-Passwoerter.
- **Wer anfragt, entscheidet der Server.** Alles unter `/api` ausser `POST /api/login`
  liegt hinter `requireAuth`, Verwaltungswege zusaetzlich hinter `requireManager`. Die
  `userId` von Wuenschen und Hinweisen stammt **aus der Sitzung**, nie aus dem Koerper.
  Wer einen neuen Endpunkt baut, ordnet ihm ausdruecklich eine Middleware zu — ohne die
  fehlt der Rollenschutz, und `PUT /api/users/:id` waere ein Weg zur eigenen Befoerderung.
  Ebenso bekommt jeder schreibende Endpunkt ein Schema aus `src/server/validierung.ts`:
  Die Schemata sind streng, unbekannte Felder sind ein Fehler. Ohne das wandert alles
  Mitgeschickte in die Datenbank.
- **Sitzungswiderruf muss den Socket mitnehmen.** `io.engine.use()` weist **nichts** ab
  (es bricht nur bei `next(err)` ab, und `express-session` ruft das nie); dafuer gibt es
  ein zusaetzliches `io.use()`. Und nach dem WebSocket-Upgrade laeuft keine Middleware
  mehr — wer eine Sitzung beendet, trennt die zugehoerigen Sockets ausdruecklich.
- **Datumsstrings sind die Wahrheit, nicht `Date`.** Wuensche haengen an `YYYY-MM-DD`,
  Monatskommentare an `YYYY-MM`, jeweils als String. `new Date(...)` wird nur zur Anzeige
  und zur Anzeige benutzt. Wer Datumslogik anfasst, prueft den Jahreswechsel: Die
  Sperrfrist rechnet deshalb mit `jahr * 12 + monat` und ausdruecklich in `Europe/Berlin`
  — ein Kalendertag ist kein Zeitpunkt.
- **Der Kalender startet montags.** `getDay()` liefert Sonntag als 0; die Umrechnung
  (`emptyDays`) ist leicht zu uebersehen.
- **Schreiben ist optimistisch ueber Sockets.** Wer eine neue Mutation baut, muss sowohl den
  REST-Endpunkt als auch das passende `io.emit` und den Listener in `App.tsx` bedienen —
  sonst sehen andere Angemeldete die Aenderung erst nach einem Neuladen.
- **Alle Angemeldeten sehen alle Wuensche — das ist entschieden, kein Versehen.** Die
  Plaene liegen auf der Station in einem offenen Hefter; die App strenger zu machen als
  das Papier loest kein Problem. Dass die Rasteransicht fuer Mitarbeitende nur die eigenen
  Eintraege zeigt, ist **Uebersichtlichkeit beim Eintragen**, keine Sicherheitsmassnahme.
  Wer daran etwas aendert, aendert Bedienkomfort. Spaetere Anonymisierung: Issue #31.
- **Eine geloeschte Person ist weg, samt Wuenschen und Hinweisen.** Das haelt das
  Datenbankschema selbst ein (`ON DELETE CASCADE`), nicht Aufraeumcode im Endpunkt.
  Deaktivieren statt Loeschen wurde geprueft und verworfen (Issue #5): Vergangene
  Monate zeigen dann Luecken statt Namen — das ist entschieden, kein Versehen.
- **Der Dunkelmodus folgt dem Geraet und hat keinen Schalter.** Er entsteht allein
  dadurch, dass die Rollen in `index.css` unter `prefers-color-scheme` andere Werte
  bekommen. Eine eingestreute Farbe (`bg-white`, `text-slate-700`) bricht ihn still —
  sichtbar wird das erst nachts auf dem Telefon. Deshalb: neue Rolle anlegen statt
  Wert einstreuen.
- **Der Erststart wiegt ~713 kB** (gzip ~226 kB), vor allem `jspdf` und `html2canvas` fuer den
  PDF-Export, den nur die Leitung braucht. Neue schwere Abhaengigkeiten gehoeren hinter ein
  `import()`.
- **`tsconfig` ist nicht `strict`.** Fehlende Typen fallen erst spaet auf. An der API-Grenze
  (`src/api/client.ts`) steht bewusst noch `any` — das ist Schuld, kein Vorbild (Issue #19).
  Ohne `strictNullChecks` grenzt TypeScript ausserdem eine Union ueber ein Boolean-Feld nicht
  ein; Ergebnistypen unterscheiden ihre Faelle deshalb ueber Zeichenketten (`art: 'gut'`).
