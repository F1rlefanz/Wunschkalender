# Wunschkalender

Dienstwunsch-Kalender für Pflegestationen. Mitarbeitende tragen ihre Schichtwünsche
(Früh, Spät, Nacht, Frei) für einen Monat ein; die Stationsleitung sieht alle Wünsche,
erkennt Überschneidungen und exportiert den Stand als PDF für die Dienstplanung.

> **Status:** in Umbau — siehe die offenen Issues. Anmeldung, Rollenprüfung und
> serverseitige Sitzungen sind vorhanden; offen ist der Betrieb selbst: wo die
> Anwendung steht und wie sie erreichbar ist, entscheidet die Krankenhaus-IT
> ([docs/betrieb.md](docs/betrieb.md), Issue #8).

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

Die Daten liegen lokal in `data.sqlite` (wird beim ersten Start angelegt und ist
bewusst nicht im Repository, da sie Benutzerkonten enthält).

## Betrieb

Wo die Anwendung steht, wie sie erreichbar ist und wer sichert, steht in
**[docs/betrieb.md](docs/betrieb.md)** — die Entscheidungsvorlage für die IT.

Produktivbetrieb: `npm run build`, dann `npm start`.

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port, auf dem die Anwendung lauscht |
| `VERTRAUE_PROXY` | `0` | Anzahl der Reverse Proxys davor. `0` heißt: keiner |
| `HSTS` | aus | `1` setzt `Strict-Transport-Security` |
| `SESSION_SECRET` | wird erzeugt | ohne Angabe legt die Anwendung `sitzungsgeheimnis` an |

`VERTRAUE_PROXY` muss zur tatsächlichen Aufstellung passen: Nur hinter einem
vertrauten Proxy glaubt die Anwendung dem `X-Forwarded-Proto` und setzt das
Sitzungscookie als `Secure`. Ohne Proxy wäre dasselbe Vertrauen eine Lücke —
dann fälscht jeder Aufrufer den Header selbst. `HSTS` gehört nur zum
Veröffentlichungsweg; im reinen HTTP-Betrieb im VPN macht der Header die
Anwendung für Monate unerreichbar. Passt die Kombination nicht zusammen, warnt
die Anwendung beim Start.

## Arbeitsweise

Offene Aufgaben stehen als **GitHub Issues**, nicht in Dateien im Repo.
Nutzersichtbare Änderungen stehen im [CHANGELOG](CHANGELOG.md).
Wie in diesem Projekt gearbeitet wird, steht in [CLAUDE.md](CLAUDE.md) und in
`.claude/skills/`.
