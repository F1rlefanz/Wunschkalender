# Fundament: Anmeldung, Autorisierung und Datenhaltung

Stand 2026-08-19. Deckt die Issues #7, #8, #9, #10, #12 und #1 ab.

## Auftrag

Die Anwendung hat heute keine serverseitige Authentifizierung. Der Login ist
React-State (`isAuthenticated` in `App.tsx`); kein `/api`-Endpunkt prueft, wer
anfragt. Alle Rollenpruefungen sind Anzeigelogik. Sie gehoert damit in kein Netz,
in dem sie tatsaechlich betrieben werden soll.

Dieses Dokument legt fest, wie das Fundament gebaut wird, auf dem alles Weitere
aufsetzt — einschliesslich der spaeteren Anmeldung mit Microsoft-Dienstkonto (#29).

## Betriebsumgebung (Auskunft des Auftraggebers, 2026-08-19)

- Gehostet wird **im Krankenhaus**, nicht privat.
- Zugegriffen wird **ueberwiegend von zuhause**: privates Smartphone, Tablet,
  Laptop, PC. Zugriff aus dem Haus ist die Ausnahme.
- **Keine Patientendaten.** Das Risiko ist die Anwendung als Einfallstor ins
  Krankenhausnetz, nicht der Inhalt.
- Das Haus nutzt Microsoft 365 / Entra ID (`csj.de` -> `Managed`, kein ADFS).
  Ein Dienstkonto bekommt jedoch nur, wer eines beantragt — also nicht alle.

Daraus folgt der Grundsatz: **Die Absicherung stuetzt sich nicht auf das Netz.**
Ob die Anwendung veroeffentlicht oder nur ueber VPN erreichbar ist, entscheidet
die Krankenhaus-IT (#30); sicher muss sie in beiden Faellen sein.

## Entscheidungen — und was verworfen wurde

### Anmeldung: Namensfeld statt Benutzerliste

Der Anmeldebildschirm laedt heute ueber `GET /api/users` alle Mitarbeitenden
samt Rolle und zeigt sie als Auswahlliste. Der Endpunkt ist ungeschuetzt.

**Gewaehlt:** Name und Passwort werden eingetippt. `GET /api/users` ist nicht
mehr oeffentlich. Der Server antwortet bei unbekanntem Namen und bei falschem
Passwort **identisch** — er gibt keine Auskunft darueber, wer existiert.

**Verworfen:** Auswahlliste beibehalten und nur die Rolle entfernen. Bequemer auf
dem Telefon, aber die Namensliste der Station bliebe fuer jeden abrufbar, der die
Seite erreicht.

**Folge:** Namen muessen eindeutig sein. Der Server erzwingt das beim Anlegen und
Umbenennen; sonst waere die Anmeldung mehrdeutig.

Findet die Migration doppelte Namen in einer bestehenden `db.json` vor, bricht sie
mit einer verstaendlichen Meldung ab und nennt die betroffenen Namen. Eindeutigkeit
still herzustellen — etwa durch Anhaengen einer Ziffer — wuerde bedeuten, dass
jemand seinen Anmeldenamen aendert, ohne es zu erfahren.

### Passwort vergessen: ersatzlos gestrichen

`POST /api/forgot-password` liefert heute den Reset-Token direkt in der Antwort,
fuer jede beliebige `userId`, ohne Anmeldung. Zusammen mit dem offenen
`GET /api/users` ist jedes Konto in zwei Anfragen uebernehmbar.

**Gewaehlt:** `/api/forgot-password` und `/api/reset-password` entfallen. Wer sein
Passwort vergisst, bekommt von der Leitung ein neues gesetzt.

**Verworfen:** Echter E-Mail-Versand (setzt E-Mail-Adressen und SMTP voraus, die es
nicht gibt) sowie ein Einmal-Passwort mit Aenderungszwang (mehr Mechanik als noetig).

**Wichtig:** Das Neusetzen durch die Leitung bekommt einen **eigenen** Endpunkt.
`PUT /api/users/:id` nimmt kein `password` mehr entgegen — heute umgeht dieses Feld
die Pruefung des alten Passworts, die `PUT /api/users/:id/password` vornimmt.

### Sitzungsdauer: ohne Ablauf, aber widerrufbar

**Gewaehlt:** Das Sitzungscookie laeuft nicht ab und uebersteht einen Neustart.
Pflegekraefte oeffnen die Anwendung nebenbei; niemand soll vor jedem Wunsch ein
Passwort tippen.

"Ohne Ablauf" gilt fuer angemeldete Menschen, nicht fuer abgeschaltete Konten.
Serverseitig zerstoert werden Sitzungen beim Abmelden, beim Passwortwechsel und
beim Loeschen eines Kontos.

### Startkonten: ein Leitungskonto mit Zufallspasswort

Heute legt der Server fuenf Demo-Benutzer mit dem Passwort `password` an.

**Gewaehlt:** Beim allerersten Start entsteht genau ein Leitungskonto; sein
Zufallspasswort wird einmalig in die Server-Konsole geschrieben. Die Leitung meldet
sich damit an und legt das Team selbst an.

**Verworfen:** Demo-Konten behalten (schleppt sie in jede echte Installation) und
Konfiguration per Umgebungsvariable (eine Datei mehr, die richtig gesetzt und
geschuetzt sein will).

### Sichtbarkeit fuer Mitarbeitende: eigene Wuensche plus anonyme Zahlen

`Calendar.tsx` filtert fuer Mitarbeitende bereits im Client auf die eigenen
Eintraege — der Server schickt aber vorher alles. Serverseitiges Filtern aendert
die Ansicht deshalb nicht, es nimmt nur Daten weg, die nie gezeigt wurden.

Nebenwirkung heute: Die Tagesbelegung ("wie viele wollen frei") zaehlt fuer
Mitarbeitende nur die eigenen Eintraege und ist damit faktisch immer 0 oder 1.

**Gewaehlt:** Der Server liefert Mitarbeitenden zusaetzlich **anonyme Zahlen** pro
Tag und Schicht — ohne Namen. Die Belegungsanzeige stimmt damit erstmals.

**Verworfen:** Zustand belassen (die Zahl bliebe irrefuehrend) und Zaehlung
ausblenden (nimmt eine Information weg, die fuer die Planung nuetzlich ist).

### Technische Basis: etablierte Bibliotheken auf SQLite

Zunaechst war ein minimaler Eigenbau vorgeschlagen (opakes Zufallstoken per
`node:crypto`, Passwort-Hashing per eingebautem `scrypt`, null Abhaengigkeiten) —
mit der Begruendung, `express-session` brauche hier zu viel Klebecode.

Dieser Einwand war eine Fehldiagnose. Der Klebecode entsteht nicht durch die
Bibliothek, sondern durch `db.json`: eine Datei, die nach **jeder** Mutation
vollstaendig neu geschrieben wird und fuer die es keinen fertigen Session-Speicher
gibt. Bei einem Absturz mitten im Schreiben ist sie zerstoert.

**Gewaehlt:** Issue #12 wird vorgezogen und zur Grundlage. Mit SQLite fuegen sich
Standardbibliotheken ohne eine Zeile Klebecode ein:

| Zweck | Bibliothek | Warum diese |
|---|---|---|
| Datenhaltung | `better-sqlite3` | Synchron, passt ohne Umbau in den bestehenden Express-Code; vorgebaute Binaerdateien, kein Compiler noetig |
| Sitzungen | `express-session` + `better-sqlite3-session-store` | Fertiger Speicher statt Eigenbau |
| Passwoerter | `@node-rs/argon2` | Argon2 ist das empfohlene Verfahren; vorgebaute Binaerdateien |
| Eingabepruefung | `zod` | Schemata liefern zugleich die Typen fuer die API-Grenze |

**Verworfen:** Eigenbau (zementiert die schlechte Grundlage und erzeugt Code, den
niemand sonst kennt) sowie stateless JWT (bei einer Sitzung ohne Ablauf der
schlechteste Weg — Abmelden waere wirkungslos, ein geloeschtes Konto kaeme weiter
hinein; man braeuchte eine Sperrliste, also doch wieder Serverzustand).

**Zu Issue #7:** Dort steht "signiertes httpOnly-Cookie". Umgesetzt wird eine
serverseitige Sitzung mit opaker Kennung — staerker, weil widerrufbar. Ein
signiertes Cookie traegt seine Aussage in sich und laesst sich nicht zuruecknehmen.

## Architektur

### Datenmodell

Tabellen: `users`, `wishes`, `monthly_comments`, `settings`, `sessions`.

`users` traegt von Anfang an die Spalten `auth_provider` (zunaechst immer
`'local'`) und `entra_oid` (zunaechst leer). Damit tritt die Microsoft-Anmeldung
(#29) spaeter daneben, ohne dass Sitzungen, Rollen oder Datenmodell erneut
angefasst werden.

### Sitzungen

Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` sobald ueber HTTPS ausgeliefert,
ohne Ablauf. Express bekommt `trust proxy`, damit es hinter einem Reverse Proxy
korrekt arbeitet.

**Das Sitzungsgeheimnis muss dauerhaft sein.** `express-session` signiert die
Sitzungskennung im Cookie mit einem Geheimnis. Wird es bei jedem Start neu erzeugt,
sind alle Sitzungen nach einem Neustart ungueltig — und die Zusage "uebersteht einen
Neustart" waere gebrochen. Es kommt deshalb aus `SESSION_SECRET`; fehlt die Variable,
erzeugt der Server beim Erststart eines und legt es neben der Datenbank ab, statt
stillschweigend ein fluechtiges zu verwenden. `.env.example` dokumentiert die
Variable.

**Socket.IO** erhaelt dieselbe Middleware ueber `io.engine.use()` — der vorgesehene
Weg. Eine Verbindung ohne gueltige Sitzung wird abgewiesen, statt wie heute jedem
Verbinder ungefragt alle Wuensche zu schicken. `cors.origin` wird von `'*'` auf die
eigene Herkunft eingeschraenkt.

### Autorisierung

Zwei Middlewares, `requireAuth` und `requireManager`. Alles ausser Anmelden und den
statischen Dateien liegt dahinter und antwortet sonst mit 401.

- Die `userId` von Wuenschen und Hinweisen stammt **aus der Sitzung**, niemals aus
  dem Request-Body.
- Loeschen nur als Eigentuemer oder Leitung.
- Die Sperrfrist wird serverseitig durchgesetzt. Dabei wird der
  Jahreswechsel-Fehler behoben und die Berechnung als reine, getestete Funktion
  herausgezogen — das ist **Issue #1**, das hier ohnehin anfaellt.
- Mitarbeitende erhalten nur eigene Wuensche und Hinweise, dazu die anonymen
  Tageszahlen. Die Leitung erhaelt alles.

### Eingabepruefung

Jeder schreibende Endpunkt validiert seinen Koerper gegen ein `zod`-Schema. Das
ersetzt das heutige ungepruefte Uebernehmen des Request-Bodys. Dieselben Schemata
liefern die Typen fuer `src/api/client.ts` — womit das `any` an der API-Grenze
verschwindet, statt weiter zu wachsen.

### API-Oberflaeche

Neu: `POST /api/logout`, `GET /api/me`, `GET /api/wishes/summary?month=`,
`PUT /api/users/:id/reset-password` (nur Leitung).

Entfaellt: `POST /api/forgot-password`, `POST /api/reset-password`.

Geaendert: `GET /api/users` nur noch angemeldet; `PUT /api/users/:id` ohne
`password`; `POST /api/wishes` und `POST /api/monthly-comments` ohne `userId` im
Koerper.

### Oberflaeche

Der Anmeldebildschirm wird neu gebaut. Dabei gilt `geraete-und-design`
verbindlich:

- Vollstaendig bedienbar auf **360 px**, Touchziele ab **44 x 44 px**.
- **Kein `alert()`.** Der heutige `Gatekeeper` benutzt es; Systemdialoge sind in
  diesem Projekt als Oberflaeche untersagt. Meldungen werden eigene Elemente.
- Sichtbarer Fokusring, Bedienbarkeit ohne Maus.

Der Anmeldebildschirm laesst Platz fuer einen zweiten Knopf ("Anmelden mit
Microsoft", #29), ohne ihn schon zu zeigen.

## Migration

Beim ersten Start liest der Server eine vorhandene `db.json` einmalig ein,
uebertraegt sie nach SQLite und benennt sie in `db.json.migriert` um. Klartext-
Passwoerter werden dabei gehasht. Der Schritt wiederholt sich nicht.

`data.sqlite` kommt in `.gitignore` — aus demselben Grund wie `db.json`: Die Datei
enthaelt Benutzerkonten. Die Schleuse (`tools/pruefe-schleuse.mjs`) prueft bisher
nur `db.json` und wird entsprechend erweitert.

## Tests und Nachweise

Bisher existiert keine einzige Testdatei. Die Grundlage entsteht hier, gezielt fuer
die Kernlogik:

- Sperrfrist als reine Funktion, einschliesslich Jahreswechsel (#1)
- Passwort-Hashing und -Pruefung
- Autorisierungsregeln je Endpunkt: angemeldet/nicht, eigene/fremde Daten, Rolle

Dazu die in den Issues geforderten `curl`-Nachweise als ausfuehrbares Skript —
insbesondere: `GET /api/wishes` ohne Cookie liefert 401.

## Etappen

Ein Branch, sechs Commits in dieser Reihenfolge:

1. SQLite-Fundament samt Migration (#12)
2. Sitzungen und Socket-Absicherung (#7)
3. Passwoerter, Startkonto, Reset-Wege (#9, #10)
4. Autorisierung und serverseitige Sperrfrist (#8, #1)
5. Anonyme Tagesbelegung
6. Tests und Nachweise

## Bewusst nicht enthalten

- **Anmeldung mit Microsoft-Dienstkonto** -> #29. Setzt eine App-Registrierung
  durch die Krankenhaus-IT voraus (Client-ID, Client-Secret, Rueckleit-Adresse).
  Vorbereitet durch `auth_provider` und `entra_oid`.
- **Hosting, HTTPS, VPN** -> #30. Entscheidung der Krankenhaus-IT.
- **Begrenzung von Anmeldeversuchen** -> Teil von #11, hier nicht umgesetzt.
- **`strict` in `tsconfig`** -> #19. Hier faellt nur das `any` an der API-Grenze weg.
