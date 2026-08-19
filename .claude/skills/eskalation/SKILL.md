---
name: eskalation
description: Verwende dies, wenn eine Aufgabe groesser, unsicherer oder folgenreicher ist als sie aussah - oder wenn du ueberlegst, Subagenten, ein Workflow-Fanout, ein staerkeres Modell oder mehr Denkaufwand einzusetzen. Regelt beide Richtungen: hochschalten und bleibenlassen.
---

# Eskalation und Aufwand

Eine Entscheidung, zwei Seiten: **wie viel Maschinerie werfe ich auf dieses Problem — und was
darf das kosten.** Beides ist dieselbe Frage, deshalb steht es hier zusammen.

Der Nutzer laeuft regelmaessig in Wochen- und Sessionlimits. Aufwand ist also nicht gratis,
und die Antwort auf jede Unsicherheit lautet nicht „mehr Agenten".

Das Partitionierungsverfahren fuer Mehrfach-Feature-Auftraege steht bereits in der globalen
`CLAUDE.md` (Abschnitt „Grosse Mehrfach-Feature-Aufgaben") und wird hier nicht wiederholt.

## Zuerst: die Gegenrichtung

Bevor du hochschaltest, pruefe, ob du es gerade nur bequem findest:

- **Kein Agent fuer etwas, das du schon im Kontext hast.** Ein frischer Agent muss alles neu
  herleiten — das ist der teure Weg, nicht der schnelle.
- **Keine dreistufige Pruefung fuer eine Umbenennung.** Der Aufwand richtet sich nach den
  Folgen eines Fehlers, nicht nach der Zeilenzahl.
- **Kein Fanout, wenn die Teile voneinander abhaengen.** Dann ist es keine Parallelitaet,
  sondern eine Kette mit Reibung.
- **Nicht hochdrehen, weil es sich gruendlich anfuehlt.** Gruendlich ist ein Ergebnis, kein Gefuehl.

## Wann hochschalten — und worauf

Die Stufen sind unabhaengig; nimm die, die zum Engpass passt.

**Mehr Denkaufwand** (`effort: max`) — wenn das Problem *Nachdenken* braucht, nicht mehr Haende:
Sicherheitsentwurf, Nebenlaeufigkeit, Datums- und Zeitzonenlogik, Datenmodell-Weichen. In
diesem Projekt sind das die Sperrfrist-Logik, die geplante Session-/Rechteschicht und alles,
was `db.json` gleichzeitig anfasst. Umgekehrt `effort: low` fuer mechanische Stufen (suchen,
umbenennen, stumpf pruefen).

**Fanout per `Workflow`** — wenn mehrere Teile *wirklich* unabhaengig sind und jedes fuer sich
Werkzeugausgaben produziert. Zweiter Grund, oft der wichtigere: die Ausgaben der Agenten landen
nie in deinem Hauptkontext. Ein Agent, der 40 Dateien durchsucht, kostet dich den Bericht
statt 40 Dateien.

**Frischer Agent ohne deinen Kontext** — wenn du den Verdacht hast, dich festgefahren zu haben.
Er teilt deine Denkfehler nicht. Gib ihm die Frage, nicht deine Zwischenergebnisse — sonst
erbt er genau das, wovon du ihn freihalten wolltest.

**Adversariale Pruefung statt bestaetigender Review** — wenn ein Befund folgenreich ist.
Mehrere Agenten mit dem ausdruecklichen Auftrag zu **widerlegen**; Mehrheit widerlegt =
verworfen. Wo ein Befund auf mehrere Arten falsch sein kann, gib jedem Pruefer eine eigene
Brille (Korrektheit, Sicherheit, laesst es sich reproduzieren) statt dreimal derselben.

**Fable 5 als Mentor** (`model: "fable"` beim `Agent`-Aufruf oder an einer `Workflow`-Stufe) —
fuer einzelne wirklich harte Urteile. Opus 5 bleibt der Dauerlaeufer; Fable ist die Ausnahme,
nicht die Steigerungsform. Sinnvolle Anlaesse:

- ein Sicherheits- oder Datenmodellentwurf, der spaeter teuer zu aendern waere
- zwei Pruefer sind uneins und du kannst nicht entscheiden
- ein Fehler, der sich nach zwei ernsthaften Anlaeufen nicht erklaeren laesst

Gib ihm eine **geschlossene Frage mit dem noetigen Material**, keinen offenen Auftrag — die
Staerke nuetzt nichts, wenn er erst suchen muss.

## Mitten drin wechseln ist erlaubt

Stellt sich heraus, dass die Aufgabe groesser ist: hochschalten und **sagen, dass und warum**.
Stellt sich heraus, dass sie kleiner ist: abbrechen, was du aufgesetzt hast, und selbst
weitermachen. Ein einmal gestartetes Verfahren ist keine Verpflichtung.

Was dabei nie wegfaellt: **Befunde aus Subagenten sind Behauptungen, bis du sie geprueft hast.**
Ein Agent, der etwas sicher formuliert, hat damit nichts bewiesen
(siehe `superpowers:verification-before-completion`).

## Kostenhygiene nebenbei

- Aufgabe fertig → Issue geschlossen → **`/clear`**. Mitgeschleppter Kontext aus erledigter
  Arbeit ist der teuerste Einzelposten und kostet bei jeder weiteren Nachricht.
- Werktags **15–21 Uhr** (13–19 Uhr GMT) laufen die Sessionlimits schneller ab. Grosse
  autonome Laeufe moeglichst daneben legen.
- `CLAUDE.md` liegt in **jeder** Nachricht im Kontext. Deshalb das Budget in der Schleuse —
  und deshalb im Zweifel auslagern statt die Schwelle anheben.
