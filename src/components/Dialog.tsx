import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  offen: boolean;
  titel: string;
  /** Wird gerufen, wenn der Dialog schliesst — auch bei Escape. */
  onSchliessen: () => void;
  children: React.ReactNode;
  /** Knoepfe am Fuss. Der bestaetigende gehoert nach rechts. */
  fuss?: React.ReactNode;
  breit?: boolean;
}

/**
 * Ein Dialog auf Grundlage des nativen `<dialog>`-Elements.
 *
 * `showModal()` bringt mit, was ein selbstgebauter Kasten aus `fixed inset-0`
 * erst nachbauen muesste: Der Fokus bleibt gefangen, Escape schliesst, der
 * Fokus kehrt danach an die aufrufende Stelle zurueck, und der Inhalt
 * dahinter ist fuer Vorlesehilfen inaktiv. Weniger eigener Code heisst hier
 * weniger, was falsch sein kann.
 *
 * **Ein Klick auf den Hintergrund schliesst bewusst nicht.** In den Dialogen
 * dieser Anwendung stehen Eingaben; ein Fehlgriff daneben duerfte sie nicht
 * verwerfen. Escape und das Kreuz genuegen.
 */
export function Dialog({ offen, titel, onSchliessen, children, fuss, breit }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (offen && !dialog.open) dialog.showModal();
    if (!offen && dialog.open) dialog.close();
  }, [offen]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onClose={onSchliessen}
      className={`m-auto w-[calc(100%-2rem)] bg-flaeche text-text rounded-lg shadow-xl p-0 max-h-[85vh] flex-col overflow-hidden open:flex ${
        breit ? 'max-w-2xl' : 'max-w-md'
      }`}
    >
      <div className="flex items-start justify-between gap-raum3 border-b border-rand px-raum4 py-raum3">
        <h2 id={titelId} className="font-ueberschrift text-titel font-semibold">
          {titel}
        </h2>
        <button
          type="button"
          onClick={onSchliessen}
          className="touchziel -m-raum2 shrink-0 rounded-sm text-leise hover:text-text"
          aria-label="Dialog schliessen"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto px-raum4 py-raum4">{children}</div>

      {fuss && (
        <div className="flex flex-wrap justify-end gap-raum2 border-t border-rand px-raum4 py-raum3">
          {fuss}
        </div>
      )}
    </dialog>
  );
}

interface BestaetigungProps {
  offen: boolean;
  titel: string;
  /** Was passiert, wenn bestaetigt wird — in ganzen Saetzen. */
  frage: string;
  bestaetigenText: string;
  onBestaetigen: () => void;
  onAbbrechen: () => void;
}

/**
 * Rueckfrage vor einem nicht umkehrbaren Schritt — der Ersatz fuer `confirm()`.
 *
 * Der bestaetigende Knopf ist in der Fehlerfarbe gehalten, aber als Umriss:
 * Gefuellt ist im Corporate Design die Marke, nicht der Fehler.
 */
export function Bestaetigung({
  offen,
  titel,
  frage,
  bestaetigenText,
  onBestaetigen,
  onAbbrechen,
}: BestaetigungProps) {
  return (
    <Dialog
      offen={offen}
      titel={titel}
      onSchliessen={onAbbrechen}
      fuss={
        <>
          <button
            type="button"
            onClick={onAbbrechen}
            className="touchziel rounded-sm px-raum4 text-klein font-medium border border-rand-stark hover:bg-flaeche-leise"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onBestaetigen}
            className="touchziel rounded-sm px-raum4 text-klein font-medium border border-fehler bg-fehler-leise text-fehler-leise-text hover:bg-fehler hover:text-fehler-kontrast"
          >
            {bestaetigenText}
          </button>
        </>
      }
    >
      <p>{frage}</p>
    </Dialog>
  );
}
