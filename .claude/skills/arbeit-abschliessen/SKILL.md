---
name: arbeit-abschliessen
description: Verwende dies, wenn eine Aufgabe in diesem Projekt fertig scheint - vor dem Merge, vor dem Schliessen eines Issues, oder wenn du "fertig" sagen willst. Legt fest, was Fertigsein hier heisst und wo das Ergebnis abgelegt wird.
---

# Arbeit abschliessen

Die mechanischen Pruefungen (Typen, Tests, Changelog vorhanden, Version, Doku-Budget)
macht `tools/pruefe-schleuse.mjs` beim `git merge`/`git push` von selbst. **Dieser Skill
regelt, was ein Skript nicht pruefen kann.**

Nicht wiederholt wird hier, was `superpowers:verification-before-completion` (Beweis vor
Behauptung) und `superpowers:finishing-a-development-branch` (Branch integrieren, aufraeumen)
bereits sagen. Beide gelten und gehen diesem Skill voraus.

## Reihenfolge

### 1. Akzeptanzkriterien einzeln durchgehen

Oeffne das Issue (`gh issue view <nr>`) und gehe **jedes** Kriterium einzeln durch. Nicht
"passt im Wesentlichen" — pro Kriterium eine Aussage, und bei jeder Aussage die Frage: welcher
Befehl oder welcher Blick beweist das? Was du nicht belegen kannst, ist nicht erfuellt.

Ist ein Kriterium nicht erfuellt und soll es auch nicht mehr werden: das gehoert in den
Issue-Kommentar mit Begruendung, nicht ins Stillschweigen.

### 2. Changelog: aus Nutzersicht, ueberarbeitend

`CHANGELOG.md`, Abschnitt `## [Unreleased]`.

- **Was hinein gehoert:** was jemand merkt, der die Anwendung benutzt.
- **Was nicht:** interne Umbauten, Refactorings, Aufraeumen ohne sichtbare Wirkung. Die stehen
  in Git. Kennzeichne solche Commits als `chore:`/`refactor:` — dann verlangt die Schleuse
  auch keinen Eintrag.
- **Formuliere aus der Perspektive der Station**, nicht aus der des Codes:
  „Wuensche fuer den Folgemonat lassen sich nach dem Stichtag nicht mehr aendern" statt
  „isMonthLocked() korrigiert".
- **Ueberarbeiten statt anhaengen:** Betrifft die Aenderung denselben Sachverhalt wie ein
  bestehender Eintrag unter `[Unreleased]`, formuliere **diesen** neu. Zwei Eintraege zum
  selben Thema sind ein Fehler, kein Verlauf.

### 3. Version bumpen

`package.json`, nach Semver: Patch fuer Fixes, Minor fuer Features, Major nur nach Ruecksprache.
Nur auf `main` bzw. beim Merge dorthin, nicht auf Feature-Branches durchreichen.

Dazu gehoert das **Datieren im Changelog**: Die Eintraege aus `[Unreleased]` wandern unter eine
Ueberschrift `## [<version>] – <JJJJ-MM-TT>`, `[Unreleased]` bleibt leer stehen. Das darf im
selben Push passieren wie die Aenderung — die Schleuse prueft, ob ein Eintrag hinzugekommen
ist, nicht unter welcher Ueberschrift er steht.

### 4. Doku dort korrigieren, wo sie falsch geworden ist

Der Kern gegen Drift. Wenn die Aenderung eine bestehende Aussage widerlegt — in `CLAUDE.md`,
im README, in einem Kommentar, in einem anderen Issue —, dann **korrigiere diese Aussage**.
Schreibe keine zweite daneben.

Pruefe dabei aktiv, ob deine eigene Aenderung Altlasten hinterlassen hat, und entferne sie:
- Code, der jetzt niemand mehr aufruft
- Kommentare, die den alten Zustand beschreiben
- Abstraktionen, die jetzt nur noch eine Stelle bedienen
- Eintraege in `.env.example` oder `package.json` fuer etwas, das es nicht mehr gibt

Das ist kein Zusatzauftrag, sondern Teil des Fertigmachens.

### 5. Issue schliessen — mit dem, was der Chat sonst mitnimmt

Der Gespraechsverlauf wird geloescht. **Was darin an Erkenntnis steckt und spaeter noch
gebraucht wird, gehoert vorher in den Issue-Kommentar.** Nicht „erledigt", sondern:

- Welche Loesung gewaehlt wurde und **welche verworfen** — mit Grund. Das ist der Teil, den
  spaeter niemand rekonstruieren kann.
- Was unterwegs auffiel und nicht hierher gehoerte → als **neues Issue** anlegen und
  verlinken, nicht im Kommentar begraben.
- Was ueber die Codebasis gelernt wurde und dauerhaft gilt → in `CLAUDE.md` (Abschnitt 4),
  nicht ins Issue.

Dann `Closes #<nr>` im Merge-Commit oder `gh issue close <nr>`.

### 6. `/clear` vorschlagen

Alles ist dort abgelegt, wo es hingehoert. Ab hier traegt der Gespraechsverlauf nur noch
Kosten — und er kostet bei **jeder** weiteren Nachricht, nicht einmalig. Schlage `/clear`
aktiv vor, statt in denselben Kontext die naechste Aufgabe zu haengen.

## Warnzeichen

| Gedanke | Wirklichkeit |
|---|---|
| „Der Changelog-Eintrag kommt beim Release" | Dann fehlt der Kontext. Jetzt schreiben. |
| „Das schreibe ich lieber zusaetzlich dazu" | Widerspruch stehenlassen ist Drift. Korrigieren. |
| „Das merke ich mir fuer die naechste Session" | Es gibt keine naechste Session mit diesem Gedaechtnis. Issue oder CLAUDE.md. |
| „Erst noch schnell die naechste Aufgabe" | Dann schleppst du den alten Kontext mit. Erst abschliessen, dann `/clear`. |
| „Die Schleuse war gruen, also bin ich fertig" | Die Schleuse prueft Mechanik. Die Punkte 1, 4 und 5 prueft sie nicht. |
