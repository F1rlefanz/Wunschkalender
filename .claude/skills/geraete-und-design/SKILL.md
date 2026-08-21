---
name: geraete-und-design
description: Verwende dies, bevor du in diesem Projekt Oberflaeche baust oder aenderst - Komponenten, Layout, Navigation, Dialoge, Formulare. Legt die Geraete-Anforderungen, die PWA-Pflichten und die Pruefmatrix fest.
---

# Geraete und Design

Zielbild: **eine Codebasis, eine PWA** — installierbar auf Android, iPhone und Desktop, ohne
Store. Kein zweiter Client, kein natives Fork.

Zur allgemeinen Gestaltungsarbeit siehe das `frontend-design`-Skill. Hier steht nur, was
**fuer dieses Projekt** gilt und was von den ueblichen Defaults abweicht.

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
sichtbar, nur die Textbeschriftungen weichen auf schmalen Schirmen den Icons
(`<span className="hidden sm:inline">`). Verstecke Beschriftung, nie den Zugang.

### Anfassbar

- Touchziele mindestens **44 x 44 px**, auch wenn das Icon kleiner aussieht.
- Nichts Wichtiges darf nur per `hover` erreichbar sein — Touchgeraete haben kein Hover.
  Der Loeschen-Knopf an den Wuensche-Chips (`opacity-0 group-hover:opacity-100`,
  `Calendar.tsx` um Zeile 322) ist genau dieser Fall und auf dem Telefon unerreichbar.
- Genug Abstand zwischen benachbarten Zielen, damit im Kalenderraster nicht der falsche Tag
  getroffen wird.

### Bedienbar ohne Maus

- Was klickbar ist, ist ein `button` oder hat `role`, `tabIndex` und Tastaturbehandlung.
  Ein `div` mit `onClick` ist keins.
- Dialoge: Fokus faengt im Dialog, `Escape` schliesst, Fokus kehrt danach zurueck.
- Sichtbarer Fokusring. Nicht wegstylen.
- Kontrast mindestens **4.5:1** fuer Text. Farbe darf nie der einzige Traeger einer Aussage
  sein — die Matrix macht es richtig: die Schichtart steht als Buchstabe im Feld, nicht
  nur als Farbe.

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
- **Startgewicht im Blick behalten.** Der Hauptbundle liegt bei ~700 kB, vor allem durch
  `jspdf` und `html2canvas` — die braucht nur die Stationsleitung fuer den Export. Solche
  Pfade gehoeren hinter ein `import()`, nicht in den Erststart auf dem Mobilfunknetz.

## Pruefmatrix — nachsehen, nicht schliessen

Aus dem Code zu folgern, dass es passt, gilt nicht. Vor dem Abschluss einer UI-Aenderung
tatsaechlich ansehen, per Chrome-MCP (`mcp__claude-in-chrome__*`) und bei Bedarf am Geraet
(`mcp__android-device__*` / `mcp__android-emulator__*`):

| Breite | Geraet | Worauf achten |
|---|---|---|
| 360 px | Telefon hochkant | Alles erreichbar? Nichts abgeschnitten? Kein Querscrollen? |
| 768 px | Tablet | Bricht das Raster sinnvoll um? |
| 1280 px | Desktop | Nutzt die Flaeche, ohne auseinanderzufallen? |

Dazu einmal ohne Maus durch den geaenderten Bereich tabben.

## Warnzeichen

| Gedanke | Wirklichkeit |
|---|---|
| „Auf dem Desktop sieht es gut aus" | Das Hauptgeraet ist das Telefon. Zuerst 360 px. |
| „`hidden md:flex` reicht erstmal" | Ohne Ersatzweg ist die Funktion auf dem Telefon weg. |
| „Der Knopf erscheint beim Draufzeigen" | Touch hat kein Draufzeigen. |
| „Ich sehe im Code, dass es passt" | Nachsehen. Layoutfehler sieht man nicht im JSX. |
| „`confirm()` ist doch nur eine Rueckfrage" | Auf dem Telefon ein Systemdialog mitten im Ablauf. Eigener Dialog. |
