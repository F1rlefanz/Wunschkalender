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

- `server.ts` — REST unter `/api/*` und Socket.IO. Zustand liegt in `memoryStore` im
  Arbeitsspeicher und wird nach jeder Mutation komplett nach `db.json` geschrieben.
- `src/App.tsx` — haelt den gesamten Anwendungszustand und die Socket-Verbindung.
  Schreiben laeuft ueber `src/api/client.ts` (REST); die Antwort wird **nicht** in den
  State geschrieben — die Aktualisierung kommt ueber das Socket-Ereignis zurueck.
- `src/components/` — `Gatekeeper` (Anmeldung), `Header`, `Calendar` (Kernstueck, ~690 Zeilen),
  `UserManagement`, `Profile`. `Calendar` haelt drei Ansichten in einer Datei
  (`viewType`: `'grid' | 'list' | 'matrix'`); wer dort etwas aendert, prueft alle drei.
- `src/types.ts` — gemeinsame Typen. Der Server kennt sie nicht, er arbeitet mit `any`.
- `tools/` — Sessionstart- und Schleusen-Skript (in `.claude/settings.json` als Hooks).

## Fallstricke

- **`db.json` gehoert nie ins Repository.** Sie enthaelt Benutzerkonten samt Passwoertern
  (derzeit im Klartext). Sie ist in `.gitignore`, und die Schleuse prueft es zusaetzlich.
- **Es gibt keine serverseitige Authentifizierung.** Der Login ist React-State
  (`isAuthenticated` in `App.tsx`); kein `/api`-Endpunkt prueft, wer die Anfrage stellt.
  Alle Rollenpruefungen sind reine Anzeigelogik. Die Anwendung gehoert in kein offenes Netz.
  Verlasse dich beim Bauen neuer Endpunkte **nicht** auf die vorhandenen als Vorbild.
- **Datumsstrings sind die Wahrheit, nicht `Date`.** Wuensche haengen an `YYYY-MM-DD`,
  Monatskommentare an `YYYY-MM`, jeweils als String. `new Date(...)` wird nur zur Anzeige
  und zur Rasterberechnung benutzt. Wer Datumslogik anfasst, prueft den Jahreswechsel —
  dort steckt bereits ein Fehler in der Sperrfrist (`Calendar.tsx`).
- **Der Kalender startet montags.** `getDay()` liefert Sonntag als 0; die Umrechnung
  (`emptyDays`) ist leicht zu uebersehen.
- **Schreiben ist optimistisch ueber Sockets.** Wer eine neue Mutation baut, muss sowohl den
  REST-Endpunkt als auch das passende `io.emit` und den Listener in `App.tsx` bedienen —
  sonst sehen andere Angemeldete die Aenderung erst nach einem Neuladen.
- **Die Ansicht ist nach Rolle gefiltert, die Daten sind es nicht.** `Calendar.tsx` filtert
  fuer Mitarbeitende auf die eigenen Eintraege, aber der Server hat vorher alles geschickt.
  Berechnungen ueber „alle Wuensche eines Tages" stimmen deshalb in der Mitarbeitersicht nicht.
- **Der Erststart wiegt ~713 kB** (gzip ~226 kB), vor allem `jspdf` und `html2canvas` fuer den
  PDF-Export, den nur die Leitung braucht. Neue schwere Abhaengigkeiten gehoeren hinter ein
  `import()`.
- **`tsconfig` ist nicht `strict`.** Fehlende Typen fallen erst spaet auf. An der API-Grenze
  (`src/api/client.ts`) steht bewusst noch `any` — das ist Schuld, kein Vorbild.
