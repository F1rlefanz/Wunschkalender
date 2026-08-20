import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '../api/client';
import { Settings } from '../types';
import { pruefeStichtag, stichtagErklaerung } from '../einstellungen';

interface EinstellungenProps {
  settings: Settings | null;
}

/**
 * Der Stichtag der Sperrfrist, einstellbar durch die Leitung. Gespeichert wird
 * ueber REST; der neue Wert kommt wie ueberall ueber `settings_updated` zurueck
 * in den Zustand, nicht aus der Antwort.
 */
export function Einstellungen({ settings }: EinstellungenProps) {
  const [eingabe, setEingabe] = useState('');
  const [bearbeitet, setBearbeitet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const gespeichert = settings ? String(settings.bookingDeadlineDay) : '';

  // Der gespeicherte Wert fuellt das Feld — aber nur, solange niemand darin
  // tippt. Sonst risse ein Ereignis eines anderen Angemeldeten die Eingabe
  // mitten im Satz weg (dieselbe Regel wie bei den Monatshinweisen).
  useEffect(() => {
    if (!bearbeitet) setEingabe(gespeichert);
  }, [gespeichert, bearbeitet]);

  const ergebnis = pruefeStichtag(eingabe);
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
      await api.updateSettings({ bookingDeadlineDay: ergebnis.wert });
      setBearbeitet(false);
      setMessage({ type: 'success', text: 'Stichtag gespeichert.' });
    } catch {
      setMessage({ type: 'error', text: 'Der Stichtag konnte nicht gespeichert werden.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center">
          <CalendarClock className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />
          Einstellungen
        </h2>
        <p className="text-sm text-slate-500 mb-6">Gilt für alle Mitarbeitenden der Station.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800 border-b pb-2">Stichtag der Sperrfrist</h3>

          {message && (
            <div
              role="status"
              className={`p-3 rounded text-sm ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <label htmlFor="stichtag" className="block text-xs font-medium text-slate-700 mb-1">
              Tag des Monats
            </label>
            <input
              id="stichtag"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={eingabe}
              onChange={(e) => {
                setBearbeitet(true);
                setEingabe(e.target.value);
                setMessage(null);
              }}
              aria-describedby="stichtag-hinweis"
              aria-invalid={ergebnis.art === 'fehler'}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            />
            <p
              id="stichtag-hinweis"
              className={`mt-1 text-xs ${ergebnis.art === 'fehler' ? 'text-amber-700' : 'text-slate-500'}`}
            >
              {ergebnis.art === 'gut' ? stichtagErklaerung(ergebnis.wert) : ergebnis.meldung}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || unveraendert || ergebnis.art === 'fehler'}
            className="w-full flex justify-center items-center min-h-[44px] py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Wird gespeichert...' : 'Stichtag speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
