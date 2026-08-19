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
