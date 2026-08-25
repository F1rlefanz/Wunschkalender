# Regeln fuer autonome Wartungsroutinen

Diese Datei ist die eine Quelle, auf die jede autonome Wartungsroutine verweist.
Die Routinen selbst leben als `SKILL.md`-Dateien ausserhalb dieses Repos (unter
`~/.claude/scheduled-tasks/`); die Regeln stehen bewusst hier, nicht dort. Vier
Kopien derselben Regel driften irgendwann auseinander, eine Datei im Repo wird
mit dem Code versioniert und ist selbst pruefbar.

## Wozu das hier gut ist

Autonome Wartungsroutinen erzeugen Pull-Requests, die kein Mensch liest. Der
Betreiber dieser Anwendung prueft sie nicht durch Lesen — die Sicherung muss
also maschinisch sein: Tests, die bei einer echten Verhaltensaenderung rot
werden, und die Schranken in diesem Dokument. Eine Anweisung an ein
Sprachmodell reicht fuer Gewohnheiten, nicht fuer Grenzen; deshalb stehen die
harten Regeln in Code und CI, nicht nur im Prompt einer Routine.

## Der gemeinsame Rahmen

Jede erzeugende Routine haelt sich an dieselben Grundregeln, unabhaengig davon,
was sie inhaltlich tut:

Sie arbeitet immer auf einem eigenen Branch nach dem Muster
`routine/<name>/<JJJJ-MM-TT>`, nie direkt auf `main`. Pro Lauf entsteht
hoechstens ein Pull-Request. Findet eine Routine nichts zu tun, beendet sie
sich still — ein "ich habe nachgesehen und nichts gefunden" ist Rauschen, das
niemand lesen soll. Bevor ein Pull-Request entsteht, muessen
`npm run lint && npm test && npm run build` lokal gruen sein; eine Routine, die
das ueberspringt, verschiebt ihre eigene Fehlersuche auf den Torwaechter, der
sie nicht leisten kann. Kein Verhaltenswechsel ohne einen Test, der ihn zeigt
— eine Aenderung, die kein Test sieht, ist fuer diese Sicherung unsichtbar und
damit so gut wie nicht geschehen. Die Pull-Request-Beschreibung hat eine feste
Form: was sich aendert, warum, und welcher Beweis (welcher Test, welcher
Messwert) dafuer steht.

## Die mechanischen Schranken

Die Regeln in diesem Abschnitt sind keine Bitte an ein Modell, sondern Code:
`tools/routine-schranken.mjs`, dort als reine Funktionen getestet (23 Tests)
und von `tools/pruefe-routine.mjs` gegen den echten Diff eines Branches
angewendet. Der CI-Auftrag `Schranken fuer Routine-Zweige` laeuft bei **jedem**
Pull-Request, nicht nur bei einem `routine/*`-Branch, und schliesst rot ab,
wenn eine Schranke verletzt ist — ohne dass jemand den Pull-Request gelesen
haben muss.

Das ist bewusst so und nicht ueber ein `if:` in der Workflow-Datei geloest:
Ein uebersprungener Auftrag bekommt die Conclusion `skipped`, und `skipped`
zaehlt bei GitHubs Required Status Checks als bestanden — ein Zweig, der
seinen Namen nicht mit `routine/` beginnt (Tippfehler oder Absicht), wuerde
die komplette Schranke sonst ohne jedes Fehlverhalten umgehen. Stattdessen
entscheidet `istRoutineZweig(name)` in `tools/routine-schranken.mjs`, ob die
Schranken ueberhaupt gelten; `tools/pruefe-routine.mjs` bekommt den
Zweignamen als zweites Argument (`${{ github.head_ref }}` aus der CI) und
beendet sich bei "kein Routine-Zweig" mit Exit 0, ohne eine einzige Regel
anzuwenden. Ein spaeterer Torwaechter kann so auf die Anwesenheit des
Auftrags pruefen, nicht nur auf seine Farbe.

Drei Zahlen und eine Liste:

- **Hoechstens 400 geaenderte Zeilen** (hinzugefuegt plus entfernt). Eine
  groessere Aenderung, die niemand liest, ist eine Wette. Braucht eine Routine
  mehr Raum, legt sie ein Issue mit Vorschlag an statt eines Pull-Requests.
- **Mindestens 20 Browsertests.** Die Abdeckungsmessung schliesst `e2e/**`
  ausdruecklich aus (siehe Abschnitt "Die bewusste Luecke"); ein geloeschter
  oder stillgelegter Browsertest wuerde die Abdeckungsschwelle also nicht
  senken, obwohl die gesamte Oberflaeche an genau diesen Tests haengt. Die
  Mindestzahl faengt genau das ab.
- **Skripte, Lifecycle-Skripte und Node-Untergrenze in `package.json` sind
  geschuetzt**, obwohl die Datei selbst nicht auf der Sperrliste steht — die
  Routine "Abhaengigkeiten" muss sie aendern koennen. Geprueft wird trotzdem
  gezielt: Die Skripte `test`, `test:coverage`, `test:e2e`, `lint` (und jedes
  andere bestehende Skript) duerfen nicht umgebogen oder entfernt werden, denn
  genau das waere der Zweizeiler, der jede Pruefung ins Leere laufen laesst,
  ohne einen Test anzufassen. Ein **neu hinzugekommenes** Lifecycle-Skript
  (`postinstall` und Verwandte) ist ebenfalls ein Verstoss: `npm ci` fuehrt
  ein solches Skript ohne Zutun aus, noch bevor irgendeine Pruefung laeuft,
  und koennte den Arbeitsbaum umschreiben, bevor der Diff etwas davon sieht —
  deshalb laeuft `npm ci` im Schranken-Auftrag selbst zusaetzlich mit
  `--ignore-scripts`. Die Node-Untergrenze unter `engines` darf sich nicht
  aendern, denn eine zu niedrige Grenze laesst die CI abstuerzen statt lesbar
  zu scheitern — genau so ist es in diesem Projekt schon einmal tagelang
  unbemerkt geblieben. Hinzufuegen neuer (nicht-lifecycle) Skripte bleibt
  erlaubt.
- **Die Fassungen der Pruefwerkzeuge duerfen nicht sinken.** `vitest`,
  `@vitest/coverage-v8`, `@playwright/test` und `typescript` bestimmen selbst,
  wie streng geprueft wird — eine Routine "Abhaengigkeiten", die eines davon
  auf eine aeltere Fassung setzt, kann damit unbemerkt die Werkzeuge
  schwaechen, die sie selbst kontrollieren. Verglichen werden die fuehrenden
  Zahlen in `devDependencies` (vorher gegen nachher); ein neu eingefuegtes
  `overrides`- oder `resolutions`-Feld in `package.json` ist aus demselben
  Grund ebenfalls ein Verstoss, denn darueber liesse sich eine Fassung
  erzwingen, ohne den sichtbaren Eintrag zu aendern.
- **Der Beweiswert der Browsertests darf nicht sinken**, in drei Teilen:
  Die Zahl der Zusicherungen (`expect(`) je Datei unter `e2e/**` darf nicht
  fallen — sonst liesse sich eine Pruefung aus einem Test entfernen, ohne dass
  die Mindestzahl an Tests das bemerkt. Ein Pull-Request darf nicht
  gleichzeitig `src/components/**` und `e2e/**` anfassen — wer eine Komponente
  umbaut und im selben Zug die Tests nachzieht, die sie bewachen, hebt die
  Bewachung auf; das macht die spaetere Routine "Vereinfachung" an genau
  dieser Stelle absichtlich handlungsunfaehig. Und eine neu hinzugefuegte
  Zeile mit `test.skip(`, `test.fixme(` oder `test.fail(` in `e2e/**` ist ein
  Verstoss, weil ein solcher Test bei `playwright test --list` weiterhin als
  `expectedStatus: "passed"` zaehlt, in der CI aber nichts mehr prueft — die
  Mindestzahl an Browsertests wuerde das allein nicht sehen.
- **Gesperrte Pfade.** Keine erzeugende Routine darf diese Pfade beruehren.
  Bei jedem der Grund:
  - `.github/` (nicht nur `.github/workflows/`) — der Auftrag, der die
    Schranken selbst durchsetzt, und alles, was GitHub sonst dort ausfuehrt,
    etwa ein spaeterer Ordner `.github/actions/`.
  - `.claude/` — die Schleuse und die uebrige Einrichtung, ueber die eine
    Routine ausserhalb der CI kontrolliert wird.
  - `tools/` (das ganze Verzeichnis, nicht nur einzelne Dateien) — traegt die
    Schleuse, die Changelog-Pruefung und die Schranken selbst; ein einzeln
    ungesperrtes Werkzeug darin (etwa ein spaeterer Hook, der auf dem Rechner
    des Betreibers laeuft) waere sonst eine Luecke in einer sonst
    geschuetzten Nachbarschaft.
  - `docs/routinen.md` — diese Datei. Eine Routine darf die Regeln, an die sie
    sich haelt, nicht selbst umschreiben.
  - `CLAUDE.md` — liegt in jeder Nachricht im Kontext jedes Claude,
    einschliesslich des Torwaechters, der den Pull-Request gegenliest. Ein
    Pull-Request, der sie "aufraeumt", schriebe an seinen eigenen Pruefer.
  - `vitest.config.ts` — hier liessen sich die Abdeckungsschwellen senken oder
    Dateien aus der Messung ausschliessen, ohne einen Test anzufassen.
  - `playwright.config.ts` — hier liesse sich `testDir` umleiten oder
    `forbidOnly` abschalten und damit ein `test.only` unbemerkt lassen.
  - `tsconfig.json` — hier liesse sich `include` kuerzen, sodass `e2e/` nicht
    mehr typgeprueft wird.
  - `src/server/passwords.ts`, `src/server/session-store.ts`,
    `src/server/session-secret.ts`, `src/server/validierung.ts` — die
    sicherheitsnahen Serverbausteine. Ein Fehler hier faellt einer Routine
    nicht auf, denn er zeigt sich nicht in gruenen Tests, sondern in einer
    Luecke, die noch keiner gefunden hat.
  - `src/server/app.ts` — traegt `requireAuth`, `requireManager` und ihre
    Zuordnung zu den Endpunkten, der teuerste Fallstrick, den `CLAUDE.md`
    selbst benennt (`PUT /api/users/:id` als Weg zur eigenen Befoerderung).

## Warum Testdateien nicht gesperrt sind

Die Sperrliste oben verbietet gezielte Dateien und Verzeichnisse — Testdateien
stehen absichtlich nicht darauf. Die Regel lautet nicht "Tests sind
unantastbar", sondern "der Beweiswert einer Aenderung darf nicht sinken". Ein
Verbot, Testdateien anzufassen, wuerde die Routine "Toter Code" von Anfang an
blockieren, deren Auftrag ausdruecklich einschliesst, Tests ohne echte
Zusicherung zu entfernen — Reste, die nichts mehr pruefen und nur noch
Laufzeit kosten. Ein pauschales Verbot verhindert also auch das Sinnvolle.
Stattdessen wird das **Wegnehmen gezaehlt**: Die Mindestzahl an Browsertests
und die Abdeckungsschwellen aus `vitest.config.ts` duerfen nicht sinken. Wer
einen Test entfernt, ohne dass eine dieser Zahlen unter ihre Schwelle faellt,
hat tatsaechlich nur totes Gewicht entfernt; wer eine Zahl darunter druecken
wuerde, faellt der CI auf, ganz ohne dass jemand die Datei gelesen haben muss.

## Die bewusste Luecke bei der Abdeckung

Die Abdeckungsschwellen in `vitest.config.ts` liegen nicht auf dem gemessenen
Stand, sondern jeweils zwei Punkte darunter (Statements/Lines 32 statt 34,
Functions 86 statt rund 89, Branches 82 statt rund 84, ebenso bei den
Bereichsschwellen fuer `src/server/**` und die reinen Logikdateien). Das ist
Absicht: Ohne diesen Spielraum wuerde schon eine harmlose neue Zeile — eine,
die richtig ist, aber noch keinen eigenen Test hat — die CI rot faerben, ohne
dass etwas kaputt ist. Der Preis dafuer ist, dass eine Routine diese zwei
Punkte Luft ausschoepfen kann, bevor die Schranke greift. Wer die Zahlen in
`vitest.config.ts` aendert — die Schwellen selbst oder den Abstand zum
gemessenen Wert — aendert eine Absprache, keine Kleinigkeit, und `vitest.config.ts`
steht deshalb auch auf der Sperrliste oben.

## Was die Schranken nicht leisten

Der CI-Auftrag `Schranken fuer Routine-Zweige` laeuft aus der Workflow-Datei
des Pull-Request-Zweiges selbst, denn GitHub fuehrt Workflows bei
`pull_request` aus dem Head-Branch aus. Gegen eine Aenderung an genau dieser
Datei (`.github/workflows/ci.yml`) schuetzt der Auftrag deshalb nicht selbst —
er wuerde in der veraenderten Fassung laufen. Wirksam ist ausschliesslich eine
Branch Protection Rule mit Required Status Checks auf `main`, eingerichtet in
den GitHub-Repository-Einstellungen: Ein fehlender oder umbenannter Required
Check blockiert dann den Merge ebenso wie ein roter. Das ist eine Handlung auf
GitHub, keine Aenderung in diesem Repo — sie kann hier nicht eingerichtet
werden, muss aber stehen, bevor irgendeine Routine Merge-Rechte bekommt. Ohne
sie ist alles in diesem Dokument Kosmetik.
