import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '../api/client';
import { Settings } from '../types';
import { pruefeVorlauf, vorlaufErklaerung } from '../einstellungen';

interface EinstellungenProps {
  settings: Settings | null;
}

/**
 * Der Vorlauf des automatischen Vorschlags, einstellbar durch die Leitung.
 * Gespeichert wird ueber REST; der neue Wert kommt wie ueberall ueber
 * `settings_updated` zurueck in den Zustand, nicht aus der Antwort.
 *
 * Der Stichtag eines *einzelnen* Monats steht bewusst nicht hier, sondern im
 * Kopf des jeweiligen Monats im Kalender: Dort ist der gemeinte Monat der, den
 * man gerade ansieht — hier waere er ein Eintrag in einer Liste.
 */
export function Einstellungen({ settings }: EinstellungenProps) {
  const [eingabe, setEingabe] = useState('');
  const [bearbeitet, setBearbeitet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const gespeichert = settings ? String(settings.vorlaufTage) : '';

  // Der gespeicherte Wert fuellt das Feld — aber nur, solange niemand darin
  // tippt. Sonst risse ein Ereignis eines anderen Angemeldeten die Eingabe
  // mitten im Satz weg (dieselbe Regel wie bei den Monatshinweisen).
  useEffect(() => {
    if (!bearbeitet) setEingabe(gespeichert);
  }, [gespeichert, bearbeitet]);

  const ergebnis = pruefeVorlauf(eingabe);
  const unveraendert = eingabe.trim() === gespeichert;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ergebnis.art === 'fehler') {
      setMessage({ type: 'error', text: ergebnis.meldung });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await api.updateSettings({ vorlaufTage: ergebnis.wert });
      setBearbeitet(false);
      setMessage({ type: 'success', text: 'Vorlauf gespeichert.' });
    } catch {
      setMessage({ type: 'error', text: 'Der Vorlauf konnte nicht gespeichert werden.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-raum4 sm:p-raum5">
      <div className="bg-flaeche p-raum4 sm:p-raum5 rounded-lg shadow-sm border border-rand max-w-md mx-auto">
        <h1 className="mb-raum1 flex items-center gap-raum2 font-ueberschrift text-ueberschrift font-semibold">
          <CalendarClock className="w-5 h-5 shrink-0 text-marke" aria-hidden="true" />
          Einstellungen
        </h1>
        <p className="text-klein text-leise mb-raum5">Gilt für alle Mitarbeitenden der Station.</p>

        <form onSubmit={handleSubmit} className="space-y-raum4">
          <h2 className="border-b border-rand pb-raum2 font-ueberschrift font-medium">
            Automatischer Stichtag
          </h2>

          <p className="text-klein text-leise">
            Gilt für jeden Monat, für den im Kalender kein eigener Stichtag gesetzt ist. Ein
            gesetzter Stichtag bleibt davon unberührt.
          </p>

          {message && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`rounded-sm border p-raum3 text-klein ${
                message.type === 'success'
                  ? 'border-rand bg-flaeche-leise'
                  : 'border-fehler bg-fehler-leise text-fehler-leise-text'
              }`}
            >
              {message.text}
            </p>
          )}

          <div>
            <label htmlFor="vorlauf" className="block text-klein font-medium mb-raum1">
              Vorlauf in Tagen
            </label>
            <input
              id="vorlauf"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={eingabe}
              onChange={(e) => {
                setBearbeitet(true);
                setEingabe(e.target.value);
                setMessage(null);
              }}
              aria-describedby="vorlauf-hinweis"
              aria-invalid={ergebnis.art === 'fehler'}
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
            <p
              id="vorlauf-hinweis"
              className={`mt-raum1 text-winzig ${
                ergebnis.art === 'fehler' ? 'text-fehler-leise-text' : 'text-leise'
              }`}
            >
              {ergebnis.art === 'gut'
                ? vorlaufErklaerung(ergebnis.wert, settings ? settings.stichtage : {})
                : ergebnis.meldung}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || unveraendert || ergebnis.art === 'fehler'}
            className="w-full flex justify-center items-center min-h-11 rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief disabled:opacity-50"
          >
            {loading ? 'Wird gespeichert...' : 'Vorlauf speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
