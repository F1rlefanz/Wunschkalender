---
name: geraete-und-design
description: Verwende dies, bevor du in diesem Projekt Oberflaeche baust oder aenderst - Komponenten, Layout, Navigation, Dialoge, Formulare. Legt die Geraete-Anforderungen, die PWA-Pflichten und die Pruefmatrix fest.
---

# Geraete und Design

Zielbild: **eine Codebasis, eine PWA** — installierbar auf Android, iPhone und Desktop, ohne
Store. Kein zweiter Client, kein natives Fork.

Zur allgemeinen Gestaltungsarbeit siehe das `frontend-design`-Skill. Hier steht nur, was
**fuer dieses Projekt** gilt und was von den ueblichen Defaults abweicht.

## Zuerst: die Gestaltungsgrundlage

Farben, Schrift- und Abstandsskalen, Radien und die Mindestgroesse eines Beruehrziels stehen
**nicht in diesem Skill**, sondern in `docs/gestaltung.md` und als Tokens in `src/index.css`.
Zahlen hier zu wiederholen hiesse, eine zweite Wahrheit zu pflegen.

Die drei Regeln, die beim Bauen am haeufigsten gebrochen werden:

- In Komponenten stehen **Rollennamen** (`bg-flaeche`, `text-leise`, `border-rand`), nie
  `slate-`, `blue-` oder ein Hexwert. Fehlt eine Rolle, wird sie angelegt.
- **Rot ist die Marke, nicht der Fehler.** Unterschieden wird ueber die Form: Marke gefuellt,
  Fehler als heller Grund mit Rahmen.
- Der **Dunkelmodus folgt dem Geraet** und hat keinen Umschalter. Wer eine Farbe einstreut,
  bricht ihn — sichtbar wird das erst nachts auf dem Telefon.

## Wer das benutzt

Pflegepersonal auf Station. Daraus folgt alles Weitere:

- **Das Telefon ist das Hauptgeraet**, nicht der Zweitfall. Der Desktop ist der Sonderfall
  (Stationsleitung im Dienstzimmer).
- Bedienung oft **einhaendig, im Stehen, in Eile**, teils mit Handschuhen.
- Der Bildschirm wird **von mehreren gelesen** — Dienstwuensche sind sensibel, aber keine
  Geheimnisse vor Kollegen. Nur: nichts, was ueberrascht.

## Regeln

### Mobile zuerst, nicht mobile nachtraeglich

Baue die schmale Ansicht **zuerst** und erweitere nach oben.

**Jede** Funktion muss auf 360 px Breite erreichbar sein. Ein `hidden`-Breakpoint, der eine
Funktion auf kleinen Schirmen ersatzlos entfernt, ist ein Fehler, keine Gestaltungsentscheidung.

`src/components/Header.tsx` macht es richtig und ist das Vorbild: die Navigation bleibt immer
sichtbar, nur die Textbeschriftungen weichen auf schmalen Schirmen den Icons — und wandern
dabei nach `sr-only`, damit die Vorlesehilfe sie behaelt. Verstecke Beschriftung, nie den
Zugang.

### Anfassbar

- Touchziele: die Klasse **`touchziel`** benutzen, nicht die Zahl abschreiben.
- Nichts Wichtiges darf nur per `hover` erreichbar sein — Touchgeraete haben kein Hover.
  Wo ein Knopf sich bei Zeigergeraeten zurueckhalten soll, gibt es `beim-zeigen`: Die Klasse
  blendet ihn **nur** unter `(hover: hover)` aus und holt ihn beim Tastaturfokus zurueck.
  Ein nacktes `opacity-0 group-hover:opacity-100` ist der Fehler, den #15 behoben hat.
- Genug Abstand zwischen benachbarten Zielen, damit im Kalenderraster nicht der falsche Tag
  getroffen wird.

### Bedienbar ohne Maus

- Was klickbar ist, ist ein `button` oder hat `role`, `tabIndex` und Tastaturbehandlung.
  Ein `div` mit `onClick` ist keins.
- Dialoge: Fokus faengt im Dialog, `Escape` schliesst, Fokus kehrt danach zurueck.
- Sichtbarer Fokusring. Den setzt `:focus-visible` global; nicht wegstylen und nicht je
  Komponente nachbauen.
- Kontrast: **`npm test` rechnet ihn nach** (`src/gestaltung.test.ts`). Eine Farbkombination,
  die dort nicht steht, ist nicht geprueft — wer eine neue benutzt, traegt sie nach.
- Farbe darf nie der einzige Traeger einer Aussage sein — die Matrix macht es richtig: die
  Schichtart steht als Buchstabe im Feld, nicht nur als Farbe.

### Kein Systemdialog als Oberflaeche

`alert()`, `confirm()` und `prompt()` sind keine Gestaltung. Sie blockieren, sehen auf jedem
Geraet anders aus, sind nicht uebersetzbar und auf dem Telefon unangenehm. Ersetze sie durch
eigene Dialoge und Meldungen.

### PWA-Pflichten

Eine Aenderung an der Oberflaeche gilt erst als fertig, wenn sie diese nicht bricht:

- `manifest.webmanifest` vollstaendig (Name, Icons 192/512, `display: standalone`, Themefarbe).
- Service Worker: die App startet offline und zeigt einen verstaendlichen Zustand, wenn der
  Server nicht erreichbar ist — kein weisser Bildschirm.
- `viewport-fit` und sichere Bereiche (Notch, Gestenleiste) beruecksichtigt.
- **Startgewicht im Blick behalten.** Der Hauptbundle liegt bei ~301 kB; der PDF-Export
  (`jspdf` und `html2canvas`, zusammen mehr als der Rest der Anwendung) wird seit #14 erst
  beim Klick nachgeladen. Solche Pfade gehoeren hinter ein `import()`, nicht in den
  Erststart auf dem Mobilfunknetz.

## Pruefmatrix — nachsehen, nicht schliessen

Aus dem Code zu folgern, dass es passt, gilt nicht. Vor dem Abschluss einer UI-Aenderung
tatsaechlich ansehen, per Chrome-MCP (`mcp__claude-in-chrome__*`) und bei Bedarf am Geraet
(`mcp__android-device__*` / `mcp__android-emulator__*`):

| Breite | Geraet | Worauf achten |
|---|---|---|
| 360 px | Telefon hochkant | Alles erreichbar? Nichts abgeschnitten? Kein Querscrollen? |
| 768 px | Tablet | Bricht das Raster sinnvoll um? |
| 1280 px | Desktop | Nutzt die Flaeche, ohne auseinanderzufallen? |

Dazu einmal ohne Maus durch den geaenderten Bereich tabben — und **einmal im Dunkelmodus
nachsehen** (in den Chrome-Entwicklerwerkzeugen unter „Rendering" umschaltbar). Eine
eingestreute Farbe faellt nur dort auf.

## Warnzeichen

| Gedanke | Wirklichkeit |
|---|---|
| „Auf dem Desktop sieht es gut aus" | Das Hauptgeraet ist das Telefon. Zuerst 360 px. |
| „`hidden md:flex` reicht erstmal" | Ohne Ersatzweg ist die Funktion auf dem Telefon weg. |
| „Der Knopf erscheint beim Draufzeigen" | Touch hat kein Draufzeigen. |
| „Ich sehe im Code, dass es passt" | Nachsehen. Layoutfehler sieht man nicht im JSX. |
| „`bg-slate-100` ist doch nur ein Grau" | Es kennt keinen Dunkelmodus und steht in keinem Kontrasttest. `bg-flaeche-leise`. |
| „`confirm()` ist doch nur eine Rueckfrage" | Auf dem Telefon ein Systemdialog mitten im Ablauf. Eigener Dialog. |
