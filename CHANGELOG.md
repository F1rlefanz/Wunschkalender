# Changelog

Alle für Nutzerinnen und Nutzer sichtbaren Änderungen an diesem Projekt.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

**Was hier hineingehört:** was jemand merkt, der die Anwendung benutzt — neue
Funktionen, geändertes Verhalten, behobene Fehler. **Was nicht:** interne Umbauten,
Refactorings und Aufräumarbeiten ohne sichtbare Wirkung. Die stehen in der
Git-Historie, und die ist eine andere Zielgruppe.

Einträge unter `[Unreleased]` werden **überarbeitet, nicht angehängt**: Betrifft eine
neue Änderung denselben Sachverhalt wie ein bestehender Eintrag, wird dieser
umformuliert statt ein zweiter danebengestellt.

**Beim Veröffentlichen** wandern die Einträge aus `[Unreleased]` unter eine datierte
Überschrift (`## [0.4.0] – 2026-08-20`). Das darf im selben Push geschehen wie die
Änderung selbst: Die Schleuse fragt, ob zu den Commits ein Eintrag *hinzugekommen* ist —
nicht, unter welcher Überschrift er steht.

## [Unreleased]

## [0.4.0] – 2026-08-20

### Hinzugefügt
- **Der PDF-Export enthält jetzt die Monatshinweise.** Unter der Wunschliste
  steht eine Tabelle mit den Hinweisen aller Personen zum ausgewählten Monat
  („höchstens 3 Nachtdienste“, „Urlaub 12.–15.“). Bisher standen im PDF nur die
  einzelnen Wünsche, und die Randbedingungen, die die Dienstplanung eigentlich
  braucht, mussten am Bildschirm nachgeschlagen werden. Lange Hinweise werden
  umbrochen, viele Hinweise laufen auf die nächste Seite.

## [0.3.1] – 2026-08-19

### Behoben
- **Unter „Allgemeine Hinweise für <Monat>“ stehen jetzt nur die Hinweise dieses
  Monats.** Bisher erschienen dort die Hinweise aller Monate, und das eigene
  Eingabefeld tauchte mehrfach auf, sobald jemand in mehreren Monaten
  kommentiert hatte.
- **Getippter Hinweistext geht nicht mehr verloren.** Schrieb jemand anderes
  gleichzeitig, wurde das eigene, noch nicht gespeicherte Feld geleert.

## [0.3.0] – 2026-08-19

### Geändert
- **Der Server prüft jetzt jede Eingabe, bevor er sie speichert.** Ein Wunsch
  braucht einen wirklichen Kalendertag und eine der vier Schichtarten, ein
  Hinweis einen Monat im Format `JJJJ-MM`; Kommentare sind auf 500, Hinweise auf
  2000 Zeichen begrenzt. Was der Server nicht kennt, übernimmt er nicht mehr —
  bisher landete alles Mitgeschickte unverändert in der Datenbank.
- **Nach zehn fehlgeschlagenen Anmeldeversuchen ist ein Konto eine
  Viertelstunde lang gesperrt.** Damit lässt sich ein Passwort nicht mehr
  durchprobieren. Wer das richtige Passwort eingibt, merkt von der Sperre
  nichts.

## [0.2.0] – 2026-08-19

### Hinzugefügt
- Die Anmeldung bleibt bestehen. Ein Neuladen der Seite, ein geschlossener
  Browser oder ein Neustart des Servers meldet niemanden mehr ab. Beim Abmelden,
  beim Ändern des Passworts (auf allen anderen Geräten) und beim Löschen eines
  Kontos endet sie sofort.

### Behoben
- Die Sperrfrist griff über den Jahreswechsel nicht: Wünsche für den Januar
  blieben im Dezember unbegrenzt änderbar, obwohl die Stationsleitung den Monat
  bereits plante.
- Die Sperrfrist gilt jetzt auch für das **Löschen**. Bisher ließ sich ein
  bereits eingeplanter Wunsch nachträglich aus einem gesperrten Monat entfernen.

### Geändert
- **Ohne Anmeldung ist nichts mehr abrufbar.** Bisher konnte jede Person, die
  die Adresse kannte, sämtliche Dienstwünsche lesen, verändern und Benutzer
  anlegen — ganz ohne Passwort.
- Was jemand darf, entscheidet jetzt der Server statt der Oberfläche. Nur die
  Stationsleitung kann Konten verwalten und den Stichtag ändern; Wünsche löscht
  nur, wem sie gehören, oder die Leitung.
- Die Anmeldung erfolgt über ein Namensfeld statt einer Auswahlliste. Die Liste
  aller Mitarbeitenden war ohne Anmeldung abrufbar, samt Rollen.
- Passwörter werden nicht mehr im Klartext gespeichert, sondern nur noch als
  Prüfsumme. Auch wer die Datenbank in die Hand bekommt, kann sie nicht mehr lesen.
- Ein neues Passwort muss mindestens acht Zeichen lang sein.
- Bei einer fehlgeschlagenen Anmeldung nennt die Meldung keinen Grund mehr. Sie
  verriet bisher, ob es ein Konto überhaupt gibt.
- Namen müssen eindeutig sein. Ein bereits vergebener Name wird beim Anlegen und
  Umbenennen abgelehnt.
- Die Daten liegen jetzt in einer Datenbank statt in einer Textdatei. Ein Absturz
  während des Speicherns kann den Bestand nicht mehr beschädigen.

### Entfernt
- Die Funktion „Passwort vergessen" mit Zurücksetz-Code. Jede beliebige Person
  konnte damit ohne Anmeldung ein fremdes Konto übernehmen, auch ein Leitungskonto.
  Wer sein Passwort vergisst, bekommt von der Stationsleitung in der
  Benutzerverwaltung ein neues gesetzt.
- Die fünf vorangelegten Demo-Konten mit dem gemeinsamen Passwort. Eine neue
  Installation startet stattdessen mit einem einzelnen Leitungskonto, dessen
  Passwort einmalig beim Start angezeigt wird.

## [0.1.0] – 2026-08-19

Erste versionierte Fassung. Der Funktionsumfang stammt aus der bisherigen Entwicklung;
neu ist, dass der Stand ab hier nachvollziehbar versioniert wird.

### Hinzugefügt
- Wunschkalender mit Monatsansicht, Mehrfachauswahl von Tagen und Schichtarten
  (Früh, Spät, Nacht, Frei).
- Drei Ansichten: Kalenderraster, Liste und Mitarbeiter-Wunschmatrix.
- Monatshinweise je Person für wiederkehrende Randbedingungen.
- Benutzerverwaltung und PDF-Export für die Stationsleitung.
- Gleichzeitige Bearbeitung: Änderungen erscheinen bei allen Angemeldeten sofort.

### Geändert
- Die Anwendung heißt im Browser jetzt „Wunschkalender" statt „My Google AI Studio App"
  und ist als deutschsprachig ausgezeichnet — Bildschirmleseprogramme sprechen sie damit
  korrekt aus.

### Bekannte Einschränkungen
- **Es gibt keine serverseitige Anmeldung.** Rollen und Sichtbarkeit werden nur in der
  Oberfläche durchgesetzt; die Schnittstelle prüft nicht, wer anfragt. Die Anwendung
  gehört derzeit in kein offenes Netz. Behebung ist als Blocker vor dem Produktivgang
  eingeplant.
- Die Sperrfrist für Wunscheinträge greift beim Jahreswechsel nicht (im Dezember bleibt
  der Januar unbegrenzt buchbar) und ist nicht über die Oberfläche einstellbar.
- Der Löschen-Knopf an einem Wunsch erscheint erst beim Draufzeigen mit der Maus und ist
  auf Touchgeräten nicht erreichbar.
