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

## [0.9.0] – 2026-08-21

### Geändert
- **Die Anwendung sieht jetzt aus wie die übrigen Anwendungen des Hauses.**
  Farben, Schriften und Rundungen stammen aus dem Corporate Design des Hauses; die
  Anmeldung und die Kopfzeile sind bereits darauf umgestellt, die übrigen
  Ansichten folgen.
- **Schrift und Abstände wachsen stufenlos mit der Bildschirmbreite** statt an
  festen Schwellen zu springen. Auf den Bildschirmgrößen zwischen Telefon und
  Tablet — wo bisher nichts passierte — passt sich die Anzeige jetzt an.
- **Die Anwendung folgt dem Dunkelmodus des Geräts.** Wer sein Telefon nachts
  dunkel stellt, bekommt die Anwendung dunkel; einen eigenen Schalter dafür
  gibt es bewusst nicht.

### Behoben
- **In der Kopfzeile ließen sich auf schmalen Telefonen die Einstellungen nicht
  mehr treffen** — der Export-Knopf lag darüber. Alle Knöpfe der Kopfzeile sind
  jetzt mindestens 44 × 44 Pixel groß und überschneiden sich auf keiner Breite
  mehr.
- **Nebentext war auf dem Seitenhintergrund zu blass**, um die
  Lesbarkeitsanforderungen zu erfüllen. Er ist jetzt kräftiger.

## [0.8.0] – 2026-08-21

### Geändert
- **Der Stichtag ist jetzt ein Datum je Monat statt eines Tages im Monat.** Über
  jedem Monat steht, bis wann Wünsche eingetragen werden können — „Wünsche bis
  06.09." bzw. „Geschlossen seit 07.09.". Damit steht der Termin in der
  Anwendung und nicht mehr nur auf einem Zettel am schwarzen Brett.
- **Ein Monat ist bis einschließlich seinem Stichtag offen.** Bisher schloss er
  am Stichtag selbst. „Eintragen bis zum 28." heißt auf der Station, dass der
  28. mitzählt.

### Hinzugefügt
- **Die Stationsleitung kann für einen einzelnen Monat einen festen Stichtag
  setzen** — direkt über der Monatsansicht, für den Monat, den sie gerade
  ansieht. Ein gesetzter Stichtag gilt dauerhaft und wird von der Automatik nie
  überschrieben; „Automatik" nimmt ihn wieder zurück. So lässt sich ein Monat
  auch länger offen halten oder für Nachzügler noch einmal öffnen.
- **Ein automatischer Stichtag greift für jeden Monat, für den nichts
  hinterlegt ist:** Er schließt acht Wochen vor Monatsbeginn. Der Vorlauf ist in
  den Einstellungen in Tagen einstellbar und wird dort an einem echten Monat
  erklärt.

### Entfernt
- **Die Einstellung „Tag des Monats" für die Sperrfrist entfällt.** Sie zielte
  immer auf den Folgemonat und konnte den Monat, um den es gerade geht, gar
  nicht schließen — auf der Station wird der Plan Wochen im Voraus geschrieben.
  Ein alter Wert wird nicht übernommen: Er ließe sich nicht in einen Vorlauf
  umrechnen. Nach dem Umstieg gilt der Vorschlag von acht Wochen.

## [0.7.0] – 2026-08-21

### Entfernt
- **Die rote Konfliktmarkierung im Kalender ist weg.** Tage mit mehr als zwei
  Wünschen oder mehr als einem Frei-Wunsch wurden bisher rot hinterlegt. Die
  Zahlen dahinter standen fest im Programm und hatten keinen Bezug zur
  Stationsgröße — sie warnten vor etwas, das oft keines war. Wer wie viele
  Wünsche hat und wie sie sich vertragen, entscheidet die Stationsleitung beim
  Schreiben des Plans; der Kalender zeigt die Wünsche, er bewertet sie nicht.

## [0.6.0] – 2026-08-20

### Hinzugefügt
- **Die Stationsleitung stellt den Stichtag selbst ein.** Unter „Einstellungen"
  steht, ab welchem Tag des Monats Mitarbeitende den Folgemonat nicht mehr
  ändern können. Bisher stand diese Zahl fest im Programm und liess sich nur
  durch einen Eingriff in die Datenbank ändern. Die Änderung gilt sofort für
  alle Angemeldeten, ohne dass jemand die Seite neu lädt.

### Behoben
- **Ein Stichtag am Monatsende greift jetzt in jedem Monat.** Wer den 29., 30.
  oder 31. wählt, hätte im Februar sonst gar keine Sperre gehabt – der
  März wäre bis zum 1. März offen geblieben. In Monaten ohne diesen Tag
  greift die Sperre nun am letzten Tag des Monats.

## [0.5.0] – 2026-08-20

### Geändert
- **Der laufende Monat ist für Mitarbeitende gesperrt.** Bisher liessen sich am
  19. August noch Wünsche für den 25. August eintragen – obwohl der Dienstplan
  für August längst steht und hängt. Jetzt gilt für den laufenden Monat dasselbe
  wie für die Vergangenheit: keine neuen Wünsche, kein Löschen, kein Monatshinweis.
  Kurzfristige Änderungen laufen wie bisher über die Leitung, die weiterhin jeden
  Monat bearbeiten kann.

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
