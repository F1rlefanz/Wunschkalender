# Autonome Wartung: Testnetz, Routinen, Torwaechter

Stand 2026-08-25. Vorbild ist der interne Anthropic-Versuch, Claude die taegliche
Wartung eigener Anwendungen zu ueberlassen (388 Pull-Requests, 180 gemergt).
Uebernommen wird die Idee, nicht der Zuschnitt: Von zwoelf Routinen dort treffen
hier vier zu, und der entscheidende Unterschied liegt woanders.

## Warum das hier anders aussehen muss

Bei Anthropic ist der Mensch die Sicherung. 208 von 388 Pull-Requests wurden
verworfen, weil jemand den Diff gelesen hat. Diese Sicherung gibt es in diesem
Projekt nicht — der Betreiber liest keinen Code.

Daraus folgt die tragende Entscheidung dieses Entwurfs: **Eine Aenderung darf nur
dann autonom nach `main`, wenn Tests beweisen, dass sich das Verhalten nicht
geaendert hat.** Ein zweiter Claude als Gegenleser ergaenzt das, ersetzt es aber
nicht — zwei Modelle koennen denselben Denkfehler haben, ein rot laufender Test
nicht.

Der Ausgangszustand widerspricht dem noch:

| Bereich | Umfang | Tests |
|---|---|---|
| `src/server/*`, `sperrfrist`, `export`, `hinweise`, `einstellungen` | Kernlogik | 14 Dateien, ~1550 Zeilen — gut abgedeckt |
| `server.ts` (REST, Auth, Sockets) | alle Endpunkte | keine |
| `src/App.tsx`, `src/components/*` | die ganze Oberflaeche | keine |

`Calendar.tsx` mit rund 680 Zeilen und drei Ansichten in einer Datei ist der
groesste Kandidat fuer Vereinfachung — und zugleich der Ort, an dem eine
autonome Aenderung heute nichts aufhalten wuerde. Gruen hiesse dort nur, dass es
kompiliert.

Deshalb: erst das Netz, dann die Routinen.

Ein Umstand macht den Versuch gerade jetzt billig: Die Anwendung laeuft nirgends
produktiv (Hosting offen, Issue #30). Ein fehlerhafter Merge trifft derzeit
`main`, nicht die Station.

## Aufbau

Drei Teile, klar getrennt:

1. **Das Testnetz** — im Repo, laeuft in der CI, unabhaengig von jeder Routine
   nuetzlich.
2. **Vier erzeugende Routinen** — geplante Cloud-Agenten, die ausschliesslich
   Pull-Requests und Issues erzeugen. Keine Merge-Rechte.
3. **Ein Torwaechter** — eine taegliche Routine, die als einzige mergen darf.

Die Trennung von 2 und 3 ist Absicht: Wer eine Aenderung schreibt, urteilt nicht
ueber sie. Ausserdem stehen die Merge-Regeln damit an einer Stelle statt viermal
kopiert, und eine Fehleinstellung des Torwaechters fuehrt dazu, dass nichts
gemergt wird — die harmlose Fehlerrichtung.

Laufzeitort sind geplante Claude-Cloud-Agenten (`~/.claude/scheduled-tasks/`,
Muster wie die vorhandene `cfalarm-trio-migration-watch`). Kein eingeschalteter
Rechner noetig, keine zusaetzlichen Secrets, Abrechnung ueber das bestehende Abo.
Das sitzungsgebundene `CronCreate` scheidet aus — seine Jobs sterben mit der
Sitzung.

## Teil 1: Das Testnetz

Zwei Gruppen, die verschiedene Fehlerklassen fangen.

### Endpunkt-Tests fuer `server.ts`

Vitest mit supertest, gegen eine frische Testdatenbank je Lauf. Schnell genug,
um bei jedem `npm test` mitzulaufen. Sie pruefen die Fallstricke, die `CLAUDE.md`
bereits benennt, weil sie schon einmal wehgetan haben:

- Jeder Weg unter `/api` ausser `POST /api/login` ohne Sitzung → 401.
- Verwaltungswege mit `Employee`-Sitzung → 403, insbesondere `PUT /api/users/:id`
  (der Weg zur eigenen Befoerderung).
- Eine `userId` im Anfragekoerper wird ignoriert; wirksam ist die aus der Sitzung.
- Unbekannte Felder im Koerper → 400 (die Schemata in `src/server/validierung.ts`
  sind streng, und das muss geprueft bleiben).
- Schreiben in einen gesperrten Monat → 403, auch am Stichtag selbst und am Tag
  danach.
- Beendete Sitzung trennt die zugehoerigen Sockets.
- Loeschen einer Person entfernt Wuensche und Hinweise (Kaskade im Schema).

Diese Gruppe ist billig und fangt die teuerste Fehlerklasse: fremde Daten,
fremde Rechte.

### Durchspiel-Tests im Browser

Playwright, headless Chromium, in der CI. Der Server laeuft dabei gegen eine
eigens angelegte Testdatenbank mit festen Konten (eine Leitung, zwei
Mitarbeitende), gesetzt ueber `src/server/store.ts` — nicht ueber `ensureManagerAccount`,
dessen Passwort absichtlich zufaellig ist.

Die Wege, die auf der Station tatsaechlich gegangen werden:

- Anmelden als Mitarbeitende und als Leitung.
- Wunsch setzen, aendern, loeschen.
- Derselbe Wunsch erscheint in allen drei Ansichten (`grid`, `list`, `matrix`).
  Sie liegen in einer Datei; wer eine aendert, bricht leicht die anderen.
- Monatswechsel **ueber den Jahreswechsel hinweg** (Dezember → Januar). Die
  Sperrfrist rechnet mit `jahr * 12 + monat`, und genau dort ist die Logik am
  duennsten.
- Ein gesperrter Monat zeigt keine Loeschknoepfe und kein Hinweisfeld — sonst
  laufen sie in einen 403.
- Getippter Text in einem Monatshinweis wird von einem eintreffenden
  Socket-Ereignis nicht ueberschrieben.
- Zwei Browser-Kontexte gleichzeitig: A setzt einen Wunsch, B sieht ihn ohne
  Neuladen.
- Benutzerverwaltung: anlegen, Rolle aendern, loeschen.
- PDF-Export laedt nach und liefert eine Datei (`src/pdf.ts` hinter `import()`).
- Ein Durchgang mit `prefers-color-scheme: dark`, der auf helle Flaechen prueft.
  Das ist der einzige automatische Weg, eine eingestreute `bg-white` zu
  erwischen, bevor sie nachts auf dem Telefon auffaellt.

### Abdeckungsschwelle

`vitest --coverage` mit einer Untergrenze, die in der CI erzwungen wird. Sie darf
nicht sinken. Ohne diese Schranke koennte eine Routine einen Test
„vereinfachen", der ihr im Weg steht, und die CI bliebe gruen.

**Bekannte Luecke:** `vitest.config.ts` misst die Abdeckung ueber `src/**` und
`server.ts`; `e2e/**` ist ausdruecklich ausgeschlossen. Ein `test.skip` in einer
Browsertest-Datei oder das Loeschen einer ganzen Datei laesst die
Abdeckungsschwelle deshalb unberuehrt, obwohl die Oberflaeche ausschliesslich an
diesen Tests haengt. Die Schranke dafuer steht nicht hier, sondern in Teil 2/3
(`--forbid-only`, Mindestzahl an Browsertests).

### Kosten

Playwright ist eine gewichtige neue Entwicklungs-Abhaengigkeit; die CI waechst
von rund einer auf drei bis fuenf Minuten. Am Auslieferungspaket aendert sich
nichts — der Erststart bleibt bei ~301 kB.

## Teil 2: Die erzeugenden Routinen

Jede Routine ist eine `SKILL.md` unter `~/.claude/scheduled-tasks/`. Die Regeln
stehen aber **nicht** dort, sondern im Repo unter `docs/routinen.md`; jede
Routine verweist darauf. Regeln, die in vier Dateien kopiert liegen, driften
auseinander; Regeln im Repo werden mit dem Code versioniert und sind selbst
pruefbar.

### Gemeinsamer Rahmen

- Immer ein Branch `routine/<name>/<JJJJ-MM-TT>`, nie direkt auf `main`.
- Hoechstens **ein** Pull-Request pro Lauf.
- Nichts gefunden heisst: still beenden. Kein „ich habe nachgesehen"-Rauschen.
- Diff-Obergrenze 400 geaenderte Zeilen. Groesseres wird ein Issue mit Vorschlag,
  kein Pull-Request — eine grosse Aenderung, die niemand liest, ist eine Wette.
- `npm run lint && npm test && npm run build` muessen **lokal** gruen sein, bevor
  der Pull-Request entsteht.
- Gesperrte Pfade, an die keine erzeugende Routine ruehrt: die Sicherungen
  selbst (die CI und die Schranken-Skripte, damit keine Routine ihre eigene
  Pruefung abschaltet), die Konfiguration des Testnetzes (ueber die es sich
  mit einem Zweizeiler aushebeln liesse, ohne einen Test anzufassen) sowie
  sicherheitsnahe Serverbausteine (Passwoerter, Sitzungen, Eingabepruefung).
  Die genaue, gepflegte Liste steht als `GESPERRTE_PFADE` in
  `tools/routine-schranken.mjs` und beschrieben in `docs/routinen.md` — hier
  nicht zweimal fuehren, sonst driften die Fassungen auseinander.
- Kein Verhaltenswechsel ohne einen Test, der ihn zeigt.
- Feste Form der Pull-Request-Beschreibung: was, warum, welcher Beweis.

### Die Schranken gehoeren in die CI, nicht in den Prompt

Die Regeln oben stehen in einer Anweisung an ein Sprachmodell. Das reicht fuer
Gewohnheiten, nicht fuer Schranken: Eine Anweisung kann missverstanden werden, ein
CI-Schritt nicht. Deshalb bekommt die CI einen zusaetzlichen Auftrag, der **nur
fuer `routine/*`-Branches** laeuft und den Diff gegen `main` mechanisch prueft:

- kein gesperrter Pfad beruehrt,
- nicht mehr als 400 geaenderte Zeilen,
- Abdeckung nicht gesunken,
- Playwright mit `--forbid-only` und einer Mindestzahl erwarteter Browsertests —
  sonst faengt die Abdeckungsschwelle ein geloeschtes `e2e/**`-Verhalten nicht
  (siehe Teil 1, Abdeckungsschwelle).

Rot heisst: Der Torwaechter schliesst den Pull-Request in Schritt 1, ohne ihn
ueberhaupt zu lesen. Damit haengt keine dieser Schranken am Wohlverhalten eines
Agenten — auch nicht am Wohlverhalten des Torwaechters. Eine Einschraenkung
bleibt: Dieser CI-Schritt selbst laeuft aus der Workflow-Datei des Head-Branches
und ist deshalb kein Schutz gegen eine Aenderung an genau dieser Datei — dafuer
siehe die Voraussetzung vor Teil 3.

### Die vier Routinen

Versetzt ueber die Woche, damit nie zwei Pull-Requests gleichzeitig denselben
Code anfassen.

| Tag | Routine | Auftrag | Beweis |
|---|---|---|---|
| Mo | **Abhaengigkeiten** | `npm audit`, veraltete Pakete, Aktualisierung in kleinen Schritten | Gruene CI nach dem Update — genau die Frage, die Dependabot offen laesst |
| Di | **Toter Code** | ungenutzte Exporte, Dateien und Pakete entfernen; Tests ohne Zusicherung entfernen; Zeile entfernen und es bleibt gruen → verdaechtig, mit Protokollierung markieren und in der Folgewoche pruefen | Was weg ist, kann nicht falsch werden |
| Do | **Fuzzer** | spielt die Anwendung im Browser durch, klickt und tippt wahllos mit **festem Zufalls-Startwert**, sammelt Konsolenfehler, unbehandelte Ausnahmen, 5xx-Antworten | aendert nie Code; meldet als Issue mit Startwert und Schrittfolge, also reproduzierbar |
| Sa | **Vereinfachung** | Duplikate zusammenfuehren, verschachtelte Logik entwirren; erster Kandidat `Calendar.tsx` | ausschliesslich das Testnetz — deshalb zuletzt scharf |

Der Fuzzer aendert bewusst keinen Code. Ein Fehler, den er findet, wird erst
behoben, wenn ein Test ihn rot faerbt — sonst repariert eine Routine eine
Vermutung.

## Voraussetzung fuer Teil 3: Branch Protection auf GitHub

GitHub fuehrt Workflows bei `pull_request` **aus dem Head-Branch des Pull-Requests**
aus. Eine Routine, die `.github/workflows/ci.yml` aendert, aendert damit ihre
eigene Pruefung — der gesperrte Pfad oben ist nur eine Anweisung an das Modell,
genau die Sorte Schranke, die der vorige Abschnitt als unzureichend verwirft.
Wirksam ist ausschliesslich eine **Branch Protection Rule mit Required Status
Checks** auf `main`, in den GitHub-Repository-Einstellungen. Ein fehlender oder
umbenannter Required Check blockiert den Merge dann ebenso wie ein roter.

Das ist eine Handlung des Nutzers auf GitHub, keine Repository-Aenderung — sie
kann nicht in diesem Repo eingerichtet werden. Sie muss stehen, **bevor** der
Torwaechter Merge-Rechte bekommt; ohne sie ist jede Schranke in Teil 2 Kosmetik.

## Teil 3: Der Torwaechter

Taeglich, die einzige Stelle mit Merge-Rechten. Er arbeitet jeden offenen
`routine/*`-Pull-Request ab:

1. **CI rot?** → Pull-Request schliessen, Branch loeschen. Nicht reparieren, nicht
   liegen lassen.
2. **Regelverstoss** (gesperrter Pfad beruehrt, ueber 400 Zeilen, Abdeckung
   gesunken)? → schliessen mit Begruendung.
3. **Feindselig gegenlesen.** Mehrere unabhaengige Agenten, jeder mit dem
   Auftrag, den Pull-Request zu *widerlegen*, nicht zu bewerten — je einer auf
   Korrektheit, auf Sicherheit und auf „bricht das eine der drei Ansichten".
   Mehrheit widerlegt → verworfen. Dasselbe Verfahren steht im globalen
   `CLAUDE.md` und hat dort fuenf echte Fehler vor einem Merge gefunden.
4. **Ueberlebt der Pull-Request alles:** mergen, Branch loeschen, `CHANGELOG.md`
   ergaenzen, Version bumpen — Patch fuer Aufraeumen, Minor fuer Sichtbares.
   Die Schleuse (`tools/pruefe-schleuse.mjs`, als `PreToolUse`-Hook vor jedem
   `git`-Befehl) verlangt den Changelog-Eintrag bereits von jeder Routine. Sie
   greift aber nur, weil ein Cloud-Agent dieselbe `.claude/settings.json` liest —
   sie ist ein Hook, kein CI-Schritt. Was autonom durchgehen soll, darf sich nicht
   allein darauf stuetzen; die harten Schranken gehoeren in die CI.
5. **Sonntags** eine Push-Nachricht: X gemergt, Y verworfen und warum, Z Issues
   offen.

Entscheidend: **Es entsteht nie eine Halde.** Jeder Pull-Request ist binnen eines
Tages gemergt oder samt Branch geloescht.

## Reihenfolge der Scharfschaltung

Nicht alles auf einmal. Der einzige echte Pruefstein ist, ob die Anwendung im
Gebrauch noch stimmt — und dieser Pruefstein taugt nur, wenn zur Zeit eine
Baustelle offen ist.

1. **Testnetz bauen.** Das ist die eigentliche Arbeit. Nichts laeuft autonom,
   solange es nicht steht.
2. **Torwaechter + Abhaengigkeiten + Toter Code.** Zwei Wochen beobachten.
3. **Fuzzer.** Meldet ohnehin nur, kann also frueh dazu.
4. **Vereinfachung.** Zuletzt, als ausdrueckliche Entscheidung, nicht automatisch.

## Was ausdruecklich nicht gebaut wird

- Die acht nicht zutreffenden Anthropic-Routinen: Crash-Fuzzing auf iOS/Android
  (keine mobilen Anwendungen), Feature-Flag-Inliner (keine Flags), Ant-only
  Shipper (keine internen Vorabfunktionen), Flaky-Test-Fixer (die CI hat drei
  deterministische Schritte).
- Taeglicher Betrieb aller Routinen. Ein Repo dieser Groesse hat nicht jeden Tag
  etwas zu finden; leere Laeufe kosten trotzdem.
- Selbstaendiges Ausrollen. Solange Issue #30 offen ist, endet Autonomie bei
  `main`.

## Offene Punkte fuer den Umsetzungsplan

- ~~Genaue Hoehe der Abdeckungsschwelle~~ — beantwortet: gemessen und gesetzt.
  Gesamt 32/86/82/32, `src/server/**` 92/83/98/92, Logikdateien 96/89/98/96
  (Statements/Branches/Functions/Lines), je gemessener Wert abgerundet minus 2.
- Ob `knip` oder `ts-prune` fuer die Routine „Toter Code" die bessere Grundlage
  ist.
- Ob der Torwaechter bei drei aufeinanderfolgenden verworfenen Pull-Requests
  derselben Routine diese selbsttaetig stilllegt und meldet.
