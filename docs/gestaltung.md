# Gestaltungsgrundlage

Der Wunschkalender benutzt das **Corporate Design des Hauses**, das im Projekt
CFAlarmforTimeOffice bereits produktiv ist. Es wird uebernommen, nicht neu
erfunden — und um das ergaenzt, was dem Android-Original fehlt und das Web
braucht: stufenlose Skalierung ueber alle Bildschirmbreiten (#21).

## Wo die Werte stehen

| Was | Wo |
|---|---|
| Alle Farben, Skalen, Radien | `src/index.css` — die einzige Stelle mit Hexwerten |
| Nachweis der Kontraste | `src/gestaltung.test.ts` (liest `index.css`) |
| Herkunft der Werte | `docs/gestaltung-quelle/` — Auszug aus dem Corporate Design |
| Schriftdateien und Lizenz | `src/schriften/` |

`docs/gestaltung-quelle/` ist eine **Kopie**, kein Verweis. Die Originale liegen
in `Corporate Design fuer Apps.zip` ausserhalb dieses Repositoriums; ein
Pfad in ein anderes Projekt ist keine tragfaehige Quelle.

## Die Regeln

**In Komponenten stehen Rollennamen, keine Farbnamen.** `bg-flaeche`,
`text-leise`, `border-rand` — nie `slate-200`, `blue-600` oder ein Hexwert.
Wer eine Farbe braucht, die es als Rolle nicht gibt, legt die Rolle an, statt
den Wert einzustreuen.

**Rot ist die Markenfarbe, nicht die Fehlerfarbe.** Beide sind rot und sehen
sich aehnlich. Sie werden deshalb ueber die *Form* unterschieden, nicht ueber
den Ton:

- Marke: **gefuellte** Flaeche (`bg-marke` mit `text-marke-kontrast`)
- Fehler: **heller Grund mit Rahmen** (`bg-fehler-leise`, `border-fehler`,
  `text-fehler-leise-text`)

**Farbe traegt nie allein eine Aussage.** Was rot ist, ist auch beschriftet,
umrandet oder mit `aria-current` ausgezeichnet. Das gilt fuer Rot-Gruen-Schwaeche
genauso wie fuer die Kopfzeile im Sonnenlicht.

**Der Dunkelmodus folgt dem Geraet.** Es gibt keinen Umschalter: Das Betriebs-
system meldet den Wunsch ueber `prefers-color-scheme`, und die Rollen wechseln
mit. Ein fuenfter Weg in der Kopfzeile passt auf 360 px nicht mehr.

**Beruehrziele sind mindestens 44 px.** Dafuer gibt es `touchziel`; die Zahl
wird nicht je Komponente wiederholt.

## Abweichungen vom Original — und warum

Zwei Werte des Corporate Designs sind uebernommen worden, ohne zu bestehen:

| Rolle | Original | Hier | Grund |
|---|---|---|---|
| Nebentext | `#726D68` | `#5F5A55` | 4.39:1 auf dem App-Hintergrund, gefordert sind 4.5:1 |
| Rahmen von Eingabefeldern | `#E3DED8` | `#857E76` | 1.2:1 — als Rahmen eines Bedienelements nicht erkennbar |

`#E3DED8` bleibt als reine Trennlinie (`border-rand`) in Gebrauch; dort traegt
sie keine Bedienbedeutung und darf zart sein. Auf der dunklen Kopfzeile steht
statt des Markenrots der aufgehellte Ton `#FF6B7E`: Markenrot erreicht auf
Anthrazit nur 2.88:1.

Diese Abweichungen sind gerechnet, nicht geschaetzt — `npm test` rechnet sie bei
jedem Lauf nach. Wer einen Wert in `src/index.css` aendert und dabei unter die
Schwelle rutscht, bekommt es dort gesagt.

## Die Skalen

Schrift und Abstaende wachsen **stufenlos** zwischen 360 px und 1280 px, per
`clamp()`. Zwischen diesen Breiten gibt es keinen Sprung an einem Haltepunkt —
genau das war die zweite Luecke des Android-Originals, das mit festen
`sp`-Groessen arbeitet.

Der feste `rem`-Anteil in jedem `clamp()` bleibt bewusst erhalten: Eine reine
`vw`-Skala waere gegen die Schriftgroesse des Systems taub, und wer sie
hochgestellt hat, hat einen Grund dafuer.

| Rolle | 360 px | 1280 px | Herkunft |
|---|---|---|---|
| `text-winzig` | 12 | 12.5 | `bodySmall` |
| `text-klein` | 14 | 14.5 | `bodyMedium` |
| `text-basis` | 16 | 17 | `bodyLarge` |
| `text-titel` | 20 | 22 | `titleLarge` |
| `text-ueberschrift` | 22 | 26 | `headlineMedium` |
| `text-gross` | 26 | 32 | `headlineLarge` |
| `text-riesig` | 30 | 38 | `displayMedium` |

Abstaende heissen `raum1` bis `raum7` (`p-raum4`, `gap-raum2`), Radien folgen
`Shape.kt`: `rounded-xs` 4 px bis `rounded-xl` 24 px.

Schriften: **Mulish** fuer Ueberschriften (`font-ueberschrift`), **Roboto** fuer
Fliesstext (Vorgabe). Beide werden **selbst ausgeliefert**, nicht ueber die
Google-Fonts-CDN: Die Anwendung wird ueberwiegend von privaten Geraeten aus
benutzt, und deren IP-Adressen gehen niemanden ausserhalb des Hauses etwas an.
Es sind variable Schnitte — vier Dateien, zusammen rund 130 kB, wovon im
deutschen Alltag nur die beiden Latin-Dateien (73 kB) geladen werden.

## Stand der Umstellung

Umgestellt sind `Header.tsx` und `Gatekeeper.tsx`. Die uebrigen Komponenten
(`Calendar`, `UserManagement`, `Einstellungen`, `Profile`) folgen im Zuge von
#15, #16, #17 und #20 — diese Aufgaben oeffnen dieselben Dateien ohnehin, und
eine Datei einmal anzufassen ist besser als zweimal.
