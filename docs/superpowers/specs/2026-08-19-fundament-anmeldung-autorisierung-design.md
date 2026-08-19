# Fundament: Anmeldung, Autorisierung und Datenhaltung

Stand 2026-08-19, ueberarbeitet nach zwei unabhaengigen Gegenlesungen.
Deckt die Issues #7, #8, #9, #10, #12 und #1 ab.

## Auftrag

Die Anwendung hat heute keine serverseitige Authentifizierung. Der Login ist
React-State (`isAuthenticated` in `App.tsx`); kein `/api`-Endpunkt prueft, wer
anfragt. Alle Rollenpruefungen sind Anzeigelogik. Sie gehoert damit in kein Netz,
in dem sie tatsaechlich betrieben werden soll.

## Betriebsumgebung (Auskunft des Auftraggebers, 2026-08-19)

- Gehostet wird **im Krankenhaus**, nicht privat.
- Zugegriffen wird **ueberwiegend von zuhause**: privates Smartphone, Tablet,
  Laptop, PC. Zugriff aus dem Haus ist die Ausnahme.
- **Keine Patientendaten.** Das Risiko ist die Anwendung als Einfallstor ins
  Krankenhausnetz, nicht der Inhalt.
- Das Haus nutzt Microsoft 365 / Entra ID (`csj.de` -> `Managed`, kein ADFS).
  Ein Dienstkonto bekommt jedoch nur, wer eines beantragt — also nicht alle.

Daraus folgt: **Die Absicherung stuetzt sich nicht auf das Netz.** Ob die
Anwendung veroeffentlicht oder nur ueber VPN erreichbar ist, entscheidet die
Krankenhaus-IT (#30); sicher muss sie in beiden Faellen sein.

## Die Sichtbarkeitsfrage — bewusst offen entschieden

**Alle Angemeldeten sehen den vollstaendigen Wunschplan**, mit Namen und
Freitext-Kommentaren. Der Server filtert die Wunschdaten **nicht** nach Rolle.

Begruendung des Auftraggebers: Die Wunschplaene liegen auf der Station heute in
einem offen zugaenglichen Hefter. Eine Anwendung strenger zu machen als das
Papier, das sie ersetzt, loest kein reales Problem.

Die Trennung der Ansichten bleibt — aber als **Anzeigelogik zur Uebersichtlichkeit,
nicht als Sicherheitsmassnahme**: Beim Eintragen (Rasteransicht) sieht man nur die
eigenen Wuensche, in der Mitarbeiter-Matrix den ganzen Plan. Wer daran etwas
aendert, aendert Bedienkomfort, nicht Vertraulichkeit.

**Folgen fuer Issue #8:** Dessen Kriterium "Mitarbeitende erhalten vom Server nur
die Daten, die sie sehen duerfen" ist damit hinfaellig und am Issue zu
korrigieren. Die Rollentrennung beschraenkt sich auf **Verwaltung, Eigentum und
Sperrfrist**.

**Folge fuer die Tagesbelegung:** Ein eigener Endpunkt fuer anonyme Zahlen
entfaellt ersatzlos. Die heute falsche Zaehlung (`Calendar.tsx:256` zaehlt auf der
gefilterten Liste) wird zu einer geaenderten Zeile: sie zaehlt kuenftig auf der
vollstaendigen.

Eine spaetere Anonymisierung bleibt moeglich und ist als #31 hinterlegt.

## Entscheidungen — und was verworfen wurde

### Anmeldung: Namensfeld statt Benutzerliste

Der Anmeldebildschirm laedt heute ueber `GET /api/users` alle Mitarbeitenden samt
Rolle und zeigt sie als Auswahlliste. Der Endpunkt ist ungeschuetzt.

**Gewaehlt:** Name und Passwort werden eingetippt. Der Server antwortet bei
unbekanntem Namen und bei falschem Passwort **identisch**.

**Verworfen:** Auswahlliste beibehalten und nur die Rolle entfernen — die
Namensliste der Station bliebe fuer jeden abrufbar, der die Seite erreicht.

**Folge:** Namen muessen eindeutig sein. Verglichen wird **exakt nach Trim**,
gross-/kleinschreibungssensitiv; dieselbe Regel gilt fuer den Unique-Index und
fuer die Anmeldung, damit nicht das eine erlaubt, was das andere verbietet.

Findet die Migration doppelte Namen vor, bricht sie mit Meldung ab und nennt sie.
Eindeutigkeit still herzustellen wuerde bedeuten, dass jemand seinen Anmeldenamen
aendert, ohne es zu erfahren.

### Passwort vergessen: ersatzlos gestrichen

`POST /api/forgot-password` liefert heute den Reset-Token direkt in der Antwort,
fuer jede beliebige `userId`, ohne Anmeldung. Zusammen mit dem offenen
`GET /api/users` ist jedes Konto in zwei Anfragen uebernehmbar.

**Gewaehlt:** Beide Reset-Endpunkte entfallen. Die Leitung setzt ein neues
Passwort ueber einen **eigenen** Endpunkt. `PUT /api/users/:id` nimmt kein
`password` mehr entgegen — heute umgeht dieses Feld die Pruefung des alten
Passworts.

### Sitzungsdauer: sehr lang, aber widerrufbar

**Gewaehlt:** Zehn Jahre `maxAge`.

**Warum nicht "kein Ablauf":** In `express-session` bedeutet ein fehlendes
`maxAge` ein Browser-Session-Cookie — beim Schliessen des Browsers weg. Die Zusage
"uebersteht einen Neustart" waere gebrochen worden. Ein sehr langes `maxAge` setzt
das gewuenschte Verhalten tatsaechlich um.

Serverseitig zerstoert werden Sitzungen beim Abmelden, beim Passwortwechsel
(ausser der ausloesenden Sitzung, siehe unten) und beim Loeschen eines Kontos.

### Startkonten: ein Leitungskonto mit Zufallspasswort

**Gewaehlt:** Existiert nach der Migration **kein Manager**, legt der Server genau
ein Leitungskonto an und schreibt dessen Zufallspasswort einmalig in die Konsole.
Die Bedingung ist wichtig: sonst entstuende neben migrierten Konten ein
zusaetzliches Manager-Konto, dessen Passwort nur in einem Server-Log steht.

**Verworfen:** Demo-Konten behalten; Konfiguration per Umgebungsvariable.

### Technische Basis: etablierte Bibliotheken auf SQLite

Zunaechst war ein minimaler Eigenbau vorgeschlagen (null Abhaengigkeiten) — mit
der Begruendung, `express-session` brauche zu viel Klebecode. Das war eine
Fehldiagnose: Der Klebecode entsteht durch `db.json`, eine nach **jeder** Mutation
komplett neu geschriebene Datei, fuer die es keinen fertigen Session-Speicher
gibt. Bei einem Absturz mitten im Schreiben ist sie zerstoert.

**Gewaehlt:** Issue #12 wird vorgezogen und zur Grundlage.

| Zweck | Bibliothek | Lizenz | Geprueft |
|---|---|---|---|
| Datenhaltung | `better-sqlite3` 13.0.3 | MIT | Laeuft auf Node 24 / Windows ohne Compiler; `prebuilds/` liegt im Paket |
| Sitzungen | `express-session` 1.19.0 | MIT | Reines JS |
| Passwoerter | `@node-rs/argon2` 2.1.0 | MIT | Vorgebaute Binaerdateien fuer win32-x64 |
| Eingabepruefung | `zod` 4.4.3 | MIT | siehe Typen-Abschnitt |

Zusaetzlich als devDependencies: `@types/express-session`, `@types/better-sqlite3`.

**Verworfen:** Eigenbau der gesamten Sitzungsschicht; stateless JWT (bei sehr
langer Sitzungsdauer der schlechteste Weg — Abmelden waere wirkungslos, ein
geloeschtes Konto kaeme weiter hinein).

**Zu Issue #7:** Dort steht "signiertes httpOnly-Cookie". Umgesetzt wird eine
serverseitige Sitzung mit widerrufbarer Kennung — staerker, weil ein signiertes
Cookie seine Aussage in sich traegt und sich nicht zuruecknehmen laesst.

### Sitzungsspeicher: eigener Adapter, bewusst

Der naheliegende `better-sqlite3-session-store` wird **nicht** verwendet. Geprueft
am 2026-08-19:

- **GPL-3.0-only** — alle uebrigen Abhaengigkeiten sind MIT.
- Version **0.1.0**, letzter Release **25.06.2022**.
- Ohne `maxAge` setzt er die Sitzung serverseitig auf 24 Stunden.
- Ein nicht abschaltbarer `setInterval` haelt den Node-Prozess am Leben; ein
  Vitest-Lauf, der `server.ts` importiert, haengt bis zum Timeout — und
  `tools/pruefe-schleuse.mjs` blockiert damit jeden Merge.

Die Alternativen wurden gesichtet: `session-file-store` (2022), `connect-loki`
(2022), `express-session-sqlite` (2022), `connect-better-sqlite3` (2022) sind
unbewegt; `memorystore` haelt nur im Arbeitsspeicher; `connect-sqlite3` ist zwar
gepflegt, deklariert aber **keine Lizenz** und braucht mit `sqlite3` einen zweiten
nativen Treiber, dessen Installation auf `node-gyp rebuild` zurueckfaellt.

**Gewaehlt:** Ein eigener `Store` gegen die vorhandene Datenbank — sechs Methoden.
`express-session` bleibt und leistet weiterhin das Schwierige: Cookie-Signierung,
Lebenszyklus, Schutz gegen Session-Fixation. Nur der Speicher-Adapter ist eigener
Code, gekapselt und testbar.

## Architektur

### Datenmodell

Tabellen: `users`, `wishes`, `monthly_comments`, `settings`, `sessions`.

`better-sqlite3` hat `foreign_keys` per Vorgabe **an**. `wishes`,
`monthly_comments` und `sessions` brauchen deshalb `ON DELETE CASCADE` auf die
Benutzer-Kennung, sonst schlaegt das Loeschen eines Kontos fehl. Das erledigt
zugleich Issue #5.

`journal_mode = WAL`, damit sich zwei gleichzeitig gestartete Instanzen nicht
gegenseitig blockieren.

`users` traegt von Anfang an `auth_provider` (zunaechst immer `'local'`) und
`entra_oid` (zunaechst leer), damit die Microsoft-Anmeldung (#29) spaeter
danebentritt, ohne das Datenmodell erneut anzufassen.

### Sitzungen

Cookie: `httpOnly`, `sameSite: 'lax'`, `maxAge` zehn Jahre, `secure: 'auto'`.
`express-session` erhaelt `proxy: true` — es liest `trust proxy` aus den eigenen
Optionen, nicht aus `app.set`. An #30 geht damit die Anforderung, dass der Reverse
Proxy `X-Forwarded-Proto` setzt; andernfalls wandert ein sehr langlebiges Cookie
im Klartext ueber fremde Netze.

Bei erfolgreicher Anmeldung wird `session.regenerate()` aufgerufen (Schutz gegen
Session-Fixation).

**Das Sitzungsgeheimnis muss dauerhaft sein.** Wird es bei jedem Start neu
erzeugt, sind nach einem Neustart alle Sitzungen ungueltig. Es kommt aus
`SESSION_SECRET`; fehlt die Variable, erzeugt der Server beim Erststart eines und
legt es neben der Datenbank ab. `.env.example` dokumentiert die Variable.

### Socket.IO

Die Middleware wird ueber `io.engine.use()` eingehaengt, damit `socket.request`
die Sitzung traegt. **Das allein weist nichts ab** — `engine.use` bricht nur ab,
wenn die Middleware `next(err)` aufruft, und `express-session` tut das nie. Die
Abweisung braucht deshalb zusaetzlich:

```
io.use((socket, next) => socket.request.session?.userId ? next() : next(new Error('unauthorized')))
```

**Sitzungswiderruf muss den Socket erreichen.** Nach dem WebSocket-Upgrade stellt
eine bestehende Verbindung keine HTTP-Anfragen mehr; die Middleware laeuft also
nie wieder. Ohne Gegenmassnahme empfaengt ein geloeschtes Konto tagelang weiter
alle Ereignisse — genau der Widerrufs-Vorteil, mit dem oben gegen JWT argumentiert
wurde. Deshalb: Sockets treten beim Verbinden dem Raum `user:<id>` bei, und beim
Zerstoeren einer Sitzung ruft der Server `disconnectSockets()` auf diesem Raum.

Da alle Angemeldeten alles sehen duerfen, bleibt `io.emit` fuer die
Nutzdaten-Ereignisse unveraendert richtig. `cors.origin` wird von `'*'` auf die
eigene Herkunft eingeschraenkt.

### Autorisierung

Zwei Middlewares, `requireAuth` und `requireManager`. Die Zuordnung wird hier
ausdruecklich festgeschrieben — ohne sie kann sich ein Mitarbeiter per
`PUT /api/users/<eigene-id>` mit `{"role":"Manager"}` selbst zur Leitung machen:

| Endpunkt | Schutz |
|---|---|
| `POST /api/login` | offen |
| `POST /api/logout`, `GET /api/me` | `requireAuth` |
| `GET /api/users`, `GET /api/settings` | `requireAuth` |
| `GET /api/wishes`, `GET /api/monthly-comments` | `requireAuth` |
| `POST/PUT/DELETE /api/users*` | `requireManager` |
| `PUT /api/users/:id/reset-password` | `requireManager` |
| `POST /api/settings` | `requireManager` |
| `PUT /api/users/:id/password` | `requireAuth` **und** nur die eigene `:id` |
| `POST /api/wishes`, `POST /api/monthly-comments` | `requireAuth`, `userId` aus der Sitzung |
| `DELETE /api/wishes/:id` | `requireAuth`, Eigentuemer oder Manager |

Weitere Regeln:

- Die `userId` von Wuenschen und Hinweisen stammt **aus der Sitzung**, niemals aus
  dem Request-Body. Schickt der Client eine abweichende mit, wird sie ignoriert.
- Die Sperrfrist gilt fuer **Anlegen und Loeschen** von Wuenschen sowie fuer
  Monatskommentare des gesperrten Monats; die Leitung ist ausgenommen. Nur beim
  Anlegen zu pruefen liesse eine Hintertuer offen: Ein bereits eingeplanter Wunsch
  liesse sich nachtraeglich entfernen.
- Die Sperrfrist-Berechnung wird eine reine Funktion mit Stichtag in
  **Europe/Berlin**. Ohne feste Zeitzone kippt die Sperre auf einem UTC-Server um
  ein bis zwei Stunden versetzt zur Ortszeit. Der Jahreswechsel-Fehler (#1) wird
  dabei behoben, und die **gleiche** Funktion nutzt auch `Calendar.tsx` — sonst
  zeigt der Client Eingaben an, die der Server ablehnt.

### Eingabepruefung

Jeder schreibende Endpunkt validiert seinen Koerper gegen ein `zod`-Schema.

**`zod` setzt `strictNullChecks` voraus.** Ohne diese Option leitet es optionale
und nullable Felder falsch ab und liefert stillschweigend zu weite Typen — an
einer Grenze, die gerade zum Vertrag werden soll. Deshalb wird
`strictNullChecks: true` hier bereits gesetzt; das vollstaendige `strict` bleibt
bei #19.

`req.session.userId` braucht eine Modul-Augmentation von `SessionData`. Sie kommt
nach `src/types.ts` — `tsconfig.json` inkludiert nur `src`, `server.ts`,
`vite.config.ts` und `tools`; eine Datei unter `types/` wuerde nicht geladen.

### API-Oberflaeche

Neu: `POST /api/logout`, `GET /api/me`,
`PUT /api/users/:id/reset-password` (nur Leitung).

Entfaellt: `POST /api/forgot-password`, `POST /api/reset-password`.

Geaendert: `POST /api/login` nimmt einen Namen statt einer `userId`;
`GET /api/users` nur noch angemeldet; `PUT /api/users/:id` ohne `password`;
`POST /api/wishes` und `POST /api/monthly-comments` ohne `userId` im Koerper.

### Betroffene Aufrufer

Die Gegenlesung hat ergeben, dass die erste Fassung dieses Entwurfs mehrere
Aufrufer nicht genannt hat. Vollstaendige Liste:

**`src/App.tsx`**
- Beim Start `GET /api/me` abfragen und daraus `isAuthenticated` ableiten. Ohne
  das ist "Sitzung uebersteht Neustart" nach aussen wirkungslos: Nach jedem
  Neuladen erschiene der Anmeldebildschirm.
- `onLogout` muss `POST /api/logout` aufrufen, nicht nur React-State zuruecksetzen.
- `addWish` und `saveMonthlyComment` schicken `userId` mit; entfaellt.

**`src/components/Gatekeeper.tsx`**
- Auswahlliste wird Namensfeld; `GET /api/users` entfaellt hier.
- Reset-Ablauf (`forgot`/`reset`) entfaellt vollstaendig.
- `alert()` wird durch eigene Meldung ersetzt.

**`src/components/UserManagement.tsx`**
- Zeile 71 setzt Passwoerter ueber `api.updateUser(id, { password })` — genau der
  Weg, den dieser Entwurf schliesst. Muss auf
  `PUT /api/users/:id/reset-password` umgestellt werden. Ohne diese Anpassung
  faellt die Funktion aus, die den gestrichenen Reset-Weg ersetzen soll.
- Enthaelt `prompt()`, `confirm()` und mehrere `alert()`.

**`src/components/Profile.tsx`**
- Der Passwortwechsel wuerde den Benutzer sofort abmelden, waehrend die Oberflaeche
  Erfolg meldet. Deshalb: Beim Passwortwechsel werden alle Sitzungen **ausser der
  ausloesenden** zerstoert.
- Die `:id` in der URL kommt kuenftig aus der Sitzung; weicht sie ab, antwortet der
  Server mit 403.

**`src/components/Calendar.tsx`**
- Sperrfrist-Logik (Zeile 85-105) durch die gemeinsame reine Funktion ersetzen.
- Tagesbelegung auf der vollstaendigen Wunschliste zaehlen.
- Enthaelt `confirm()`.

**Systemdialoge sind projektweit untersagt**, nicht nur im Anmeldebildschirm
(`geraete-und-design`). Alle oben genannten `alert`/`confirm`/`prompt` gehoeren
ersetzt. Umfang und Reihenfolge regelt #17; dieser Entwurf ersetzt die Stellen,
die er ohnehin anfasst, und laesst die uebrigen #17.

### Oberflaeche

Fuer den neuen Anmeldebildschirm gilt `geraete-und-design` verbindlich:
vollstaendig bedienbar auf **360 px**, Touchziele ab **44 x 44 px**, sichtbarer
Fokusring, bedienbar ohne Maus. Er laesst Platz fuer einen zweiten Knopf
("Anmelden mit Microsoft", #29), ohne ihn schon zu zeigen.

## Migration

Der Normalfall ist der Erststart ohne `db.json`. Der Migrationspfad ist der
Ausnahmefall und muss trotzdem tragen:

- **Idempotenz haengt an der Datenbank, nicht am Dateinamen.** Eine Zeile
  `settings.migriert_am` entscheidet, ob migriert wurde. Das Umbenennen der
  Quelldatei ist nur eine Aufraeum-Geste, deren Scheitern geloggt wird — unter
  Windows kann es an einem offenen Handle scheitern (Virenscanner, Editor,
  OneDrive), und daran darf kein Serverstart haengen.
- **Alle Einfuegungen in einer Transaktion.** Bricht es ab, ist nichts halb
  importiert.
- **Beschaedigte `db.json`: Abbruch mit Meldung**, Datei unangetastet. Heute
  schluckt `server.ts` den Parse-Fehler und startet mit Demo-Daten — nach diesem
  Entwurf waere das stiller Datenverlust.
- **Findet der Server Benutzer in SQLite und zugleich eine `db.json`**, bricht er
  mit Meldung ab, statt zu raten.
- **Klartext-Passwoerter werden beim Import gehasht.** Migrierte Demo-Konten mit
  dem bekannten Passwort `password` werden dabei benannt und mit einer Warnung
  versehen.

### Schutz der abgelegten Dateien

Die Gegenlesung hat belegt, dass `.gitignore` mit dem Eintrag `db.json` weder
`db.json.migriert` noch `data.sqlite` erfasst — beide erschienen in `git status`.
`db.json.migriert` enthaelt dabei die alten **Klartext-Passwoerter**.

Deshalb: `.gitignore` erhaelt `db.json*`, `data.sqlite*` (WAL erzeugt zusaetzlich
`-wal` und `-shm`) und die Geheimnis-Datei. `tools/pruefe-schleuse.mjs` prueft
heute nur `git ls-files db.json` und wird auf dieselben Muster erweitert.

## Tests und Nachweise

Bisher existiert keine einzige Testdatei. Tests entstehen **mit der jeweiligen
Etappe**, nicht gesammelt am Ende:

- Sperrfrist als reine Funktion, einschliesslich Jahreswechsel und Zeitzone (#1)
- Passwort-Hashing und -Pruefung
- Der eigene Session-Store gegen eine In-Memory-Datenbank
- Migration: Normalfall, beschaedigte Datei, doppelte Namen, zweiter Lauf
- Autorisierungsregeln je Endpunkt gemaess der Tabelle oben

Dazu die in den Issues geforderten `curl`-Nachweise als ausfuehrbares Skript —
insbesondere: `GET /api/wishes` ohne Cookie liefert 401.

## Etappen

Ein Branch. Die Reihenfolge stellt sicher, dass die Anwendung nach **jeder**
Etappe benutzbar bleibt:

1. **SQLite-Fundament, Migration und Startkonto** (#12) — das Startkonto gehoert
   hierher, nicht spaeter: Etappe 1 ersetzt das Demo-Benutzer-Array, und ohne
   `db.json` waere die Benutzertabelle sonst leer und niemand koennte sich
   anmelden.
2. **Passwoerter und Reset-Wege** (#9, #10) — inklusive `UserManagement.tsx`.
3. **Sitzungen, Session-Store und Socket-Absicherung** (#7).
4. **Anmeldebildschirm und Sitzungswiederherstellung** — `Gatekeeper.tsx`,
   `GET /api/me` und `POST /api/logout` in `App.tsx`, `Profile.tsx`. Ohne diese
   Etappe waere die Oberflaeche zwei Commits lang unbenutzbar.
5. **Autorisierung und serverseitige Sperrfrist** (#8, #1) — inklusive der
   gemeinsamen Sperrfrist-Funktion in `Calendar.tsx`.
6. **Nachweise und Aufraeumen** — `curl`-Skript, `.gitignore`, Schleuse,
   `CLAUDE.md`.

## Bewusst nicht enthalten

- **Anmeldung mit Microsoft-Dienstkonto** -> #29. Setzt eine App-Registrierung
  durch die Krankenhaus-IT voraus. Vorbereitet durch `auth_provider`/`entra_oid`.
- **Hosting, HTTPS, VPN** -> #30. Entscheidung der Krankenhaus-IT.
- **Optionale Anonymisierung des Wunschplans** -> #31.
- **Begrenzung von Anmeldeversuchen** -> Teil von #11.
- **Vollstaendiges `strict` in `tsconfig`** -> #19. Hier nur `strictNullChecks`
  und der Wegfall von `any` an der API-Grenze.
- **Alle uebrigen Systemdialoge** -> #17.
