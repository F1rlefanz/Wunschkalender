import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { api } from '../api/client';
import type { Beispielauskunft } from '../types';

/**
 * Der Hinweisstreifen der Testfassung und die Zugangsdaten auf der
 * Anmeldeseite. Beides haengt am selben Schalter (`BEISPIELDATEN` auf dem
 * Server) und verschwindet mit ihm — siehe `src/server/beispieldaten.ts`.
 */

// Eine Abfrage fuer die ganze Sitzung: Der Streifen und die Anmeldeseite
// fragen dasselbe. Zwei Aufrufe waeren nur doppelte Last fuer dieselbe Antwort.
let auskunft: Promise<Beispielauskunft> | null = null;

function hole(): Promise<Beispielauskunft> {
  auskunft ??= api.beispielmodus();
  return auskunft;
}

export function useBeispielmodus(): Beispielauskunft | null {
  const [stand, setStand] = useState<Beispielauskunft | null>(null);

  useEffect(() => {
    let lebt = true;
    hole().then((antwort) => {
      if (lebt) setStand(antwort);
    });
    return () => {
      lebt = false;
    };
  }, []);

  return stand;
}

/**
 * Steht ueber allem, auch ueber der Anmeldung. Bewusst kein Fehlerton: Das ist
 * kein Fehler, sondern eine Ansage darueber, was man hier vor sich hat.
 */
export function Testfassungsstreifen() {
  const stand = useBeispielmodus();
  if (!stand?.an) return null;

  return (
    <div
      role="status"
      className="bg-hinweis text-hinweis-text border-b border-rand-stark px-raum4 py-raum2 flex items-center justify-center gap-raum2 text-klein text-center"
    >
      <FlaskConical className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Testfassung mit erfundenen Daten.</strong>{' '}
        Alle Namen und Wünsche sind ausgedacht.
      </span>
    </div>
  );
}

/**
 * Die Zugangsdaten auf der Anmeldeseite. Ohne sie kommt niemand in die
 * Testfassung hinein, und ein Zettel daneben hilft dem nicht, der den Link
 * weitergereicht bekommt.
 */
export function BeispielZugangsdaten({ onWaehlen }: { onWaehlen: (name: string) => void }) {
  const stand = useBeispielmodus();
  if (!stand?.an || !stand.konten?.length) return null;

  return (
    <div className="mt-raum5 bg-hinweis text-hinweis-text rounded-sm border border-rand-stark p-raum4">
      <p className="text-klein font-semibold">Zugangsdaten der Testfassung</p>
      <p className="text-winzig mt-raum1">
        Passwort für alle: <code className="font-mono font-semibold">{stand.passwort}</code>
      </p>
      <ul className="mt-raum3 space-y-raum2">
        {stand.konten.map((konto) => (
          <li key={konto.name}>
            <button
              type="button"
              // Ohne eigene Beschriftung liest die Vorlesehilfe
              // "Beate BeispielStationsleitung" — der Name der Person, nicht
              // das, was der Knopf tut.
              aria-label={`Als ${konto.name} anmelden`}
              onClick={() => onWaehlen(konto.name)}
              className="touchziel w-full justify-between gap-raum3 px-raum3 py-raum2 bg-flaeche text-text border border-rand-stark rounded-xs text-klein"
            >
              <span className="font-medium">{konto.name}</span>
              <span className="text-winzig text-leise">
                {konto.rolle === 'Manager' ? 'Stationsleitung' : 'Pflegekraft'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
