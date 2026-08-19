# Wunschkalender

Dienstwunsch-Kalender fuer eine Pflegestation. Mitarbeitende tragen Schichtwuensche
(`Früh`, `Spät`, `Nacht`, `Frei`) je Tag ein; die Stationsleitung sieht alle Wuensche,
erkennt Ueberschneidungen und exportiert den Monat als PDF fuer die Dienstplanung.

Zwei Rollen, im Code `'Employee'` und `'Manager'`: Mitarbeitende sehen nur die eigenen
Wuensche, die Leitung sieht alle und verwaltet Benutzer.

## Wo was steht

| Frage | Antwort steht in |
|---|---|
| Was ist offen und warum? | **GitHub Issues** (`gh issue list`) — nicht in Dateien im Repo |
| Was hat sich fuer Nutzer geaendert? | `CHANGELOG.md` |
| Wie funktioniert die Codebasis? | diese Datei |
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
- `src/components/` — `Gatekeeper` (Anmeldung), `Header`, `Calendar` (Kernstueck, ~690 Zeilen),
  `UserManagement`, `Profile`. `Calendar` haelt drei Ansichten in einer Datei
  (`viewType`: `'grid' | 'list' | 'matrix'`); wer dort etwas aendert, prueft alle drei.
- `src/types.ts` — gemeinsame Typen fuer Client und Server.
- `src/sperrfrist.ts` — wann ein Monat gesperrt ist. **Server und Oberflaeche benutzen
  dieselbe Funktion**; zwei Fassungen waeren ein Fehler.
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
- **Der Erststart wiegt ~713 kB** (gzip ~226 kB), vor allem `jspdf` und `html2canvas` fuer den
  PDF-Export, den nur die Leitung braucht. Neue schwere Abhaengigkeiten gehoeren hinter ein
  `import()`.
- **`tsconfig` ist nicht `strict`.** Fehlende Typen fallen erst spaet auf. An der API-Grenze
  (`src/api/client.ts`) steht bewusst noch `any` — das ist Schuld, kein Vorbild (Issue #19).
