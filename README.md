# Wunschkalender

Dienstwunsch-Kalender für Pflegestationen. Mitarbeitende tragen ihre Schichtwünsche
(Früh, Spät, Nacht, Frei) für einen Monat ein; die Stationsleitung sieht alle Wünsche,
erkennt Überschneidungen und exportiert den Stand als PDF für die Dienstplanung.

> **Status:** in Umbau. Der Stand ist noch nicht produktionsreif — siehe die offenen
> Issues. Insbesondere fehlt eine serverseitige Authentifizierung; die Anwendung
> gehört derzeit in kein offenes Netz.

## Rollen

| Rolle | Darf |
|---|---|
| **Mitarbeiter** | eigene Wünsche eintragen und löschen, eigenen Monatshinweis pflegen |
| **Manager** (Stationsleitung) | alle Wünsche sehen und löschen, Benutzer verwalten, PDF exportieren |

## Entwicklung

**Voraussetzung:** Node.js 20 oder neuer.

```bash
npm install
npm run dev      # Server + Vite unter http://localhost:3000
npm run lint     # Typprüfung (tsc --noEmit)
npm test         # Unit-Tests (vitest)
npm run build    # Produktions-Build nach dist/
```

Die Daten liegen lokal in `db.json` (wird beim ersten Start angelegt und ist bewusst
nicht im Repository, da sie Benutzerkonten enthält).

## Arbeitsweise

Offene Aufgaben stehen als **GitHub Issues**, nicht in Dateien im Repo.
Nutzersichtbare Änderungen stehen im [CHANGELOG](CHANGELOG.md).
Wie in diesem Projekt gearbeitet wird, steht in [CLAUDE.md](CLAUDE.md) und in
`.claude/skills/`.
