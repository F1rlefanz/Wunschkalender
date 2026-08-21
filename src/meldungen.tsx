import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Rueckmeldungen, die den Ablauf nicht anhalten (#17).
 *
 * Ersetzt `alert()`: Ein Systemdialog blockiert, sieht auf jedem Geraet anders
 * aus und steht auf dem Telefon mitten im Weg. Eine Meldung erscheint
 * stattdessen neben der Arbeit und laesst sich weiterarbeiten.
 *
 * **Erfolg verschwindet von allein, ein Fehler nicht.** Wer auf Station in
 * Eile ist, will "Gespeichert" nicht jedes Mal wegtippen; einen Fehler aber
 * darf niemand uebersehen, nur weil er kurz nicht hingesehen hat.
 */
export type Meldungsart = 'gut' | 'fehler';

export interface Meldung {
  id: number;
  art: Meldungsart;
  text: string;
}

/** Wie lange eine Erfolgsmeldung stehen bleibt. */
const ERFOLG_DAUER_MS = 6000;

interface Meldungssteuerung {
  melde: (art: Meldungsart, text: string) => void;
  verwirf: (id: number) => void;
  meldungen: Meldung[];
}

const MeldungsKontext = createContext<Meldungssteuerung | null>(null);

export function MeldungsBereich({ children }: { children: React.ReactNode }) {
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const naechsteId = useRef(1);

  const verwirf = useCallback((id: number) => {
    setMeldungen((bisher) => bisher.filter((m) => m.id !== id));
  }, []);

  const melde = useCallback(
    (art: Meldungsart, text: string) => {
      const id = naechsteId.current++;
      // Hoechstens drei auf einmal: Was darunter liegt, liest ohnehin niemand
      // mehr, und der Stapel verdeckt sonst die Arbeit.
      setMeldungen((bisher) => [...bisher, { id, art, text }].slice(-3));
      if (art === 'gut') {
        setTimeout(() => verwirf(id), ERFOLG_DAUER_MS);
      }
    },
    [verwirf],
  );

  const wert = useMemo(() => ({ melde, verwirf, meldungen }), [melde, verwirf, meldungen]);

  return <MeldungsKontext.Provider value={wert}>{children}</MeldungsKontext.Provider>;
}

/**
 * Gibt `melde(art, text)` zurueck. Ausserhalb von `MeldungsBereich` ist das ein
 * Fehler und kein stiller Nichts-Passiert-Fall: Eine verschluckte Fehlermeldung
 * ist genau das Problem, das #35 beschreibt.
 */
export function useMeldung() {
  const kontext = useContext(MeldungsKontext);
  if (!kontext) {
    throw new Error('useMeldung ausserhalb von <MeldungsBereich> benutzt.');
  }
  return kontext.melde;
}

/**
 * Zeigt die offenen Meldungen an. Gehoert einmal in die Anwendung, moeglichst
 * weit unten im Baum, damit sie ueber allem liegt.
 *
 * Sie haengen dicht unter der Kopfzeile, nicht am unteren Rand: Dort steht im
 * Kalender die Leiste fuer die Mehrfachauswahl, und zwei schwebende Streifen
 * uebereinander verdecken einander.
 */
export function Meldungen() {
  const kontext = useContext(MeldungsKontext);
  if (!kontext) return null;
  const { meldungen, verwirf } = kontext;

  return (
    <div
      className="fixed inset-x-raum3 top-20 sm:inset-x-auto sm:right-raum4 sm:max-w-sm z-50 flex flex-col gap-raum2 pointer-events-none"
      // Der Bereich selbst ist die Live-Region: So wird auch eine Meldung
      // vorgelesen, die erst spaeter hinzukommt.
      aria-live="polite"
      aria-atomic="false"
    >
      {meldungen.map((meldung) => (
        <div
          key={meldung.id}
          role={meldung.art === 'fehler' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-raum2 rounded-sm border p-raum3 shadow-lg text-klein ${
            meldung.art === 'fehler'
              ? 'bg-fehler-leise border-fehler text-fehler-leise-text'
              : 'bg-flaeche border-rand text-text'
          }`}
        >
          <p className="flex-1">{meldung.text}</p>
          <button
            type="button"
            onClick={() => verwirf(meldung.id)}
            className="touchziel -m-raum2 shrink-0 rounded-sm"
            aria-label="Meldung schliessen"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
