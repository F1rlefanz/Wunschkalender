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

## [Unreleased]

### Geändert
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
