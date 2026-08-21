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
 * man gerade ansieht — hier waere er ein Eintrag in einer Liste (#36).
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center">
          <CalendarClock className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />
          Einstellungen
        </h2>
        <p className="text-sm text-slate-500 mb-6">Gilt für alle Mitarbeitenden der Station.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800 border-b pb-2">Automatischer Stichtag</h3>

          <p className="text-xs text-slate-500">
            Gilt für jeden Monat, für den im Kalender kein eigener Stichtag gesetzt ist. Ein
            gesetzter Stichtag bleibt davon unberührt.
          </p>

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
            <label htmlFor="vorlauf" className="block text-xs font-medium text-slate-700 mb-1">
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
              className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            />
            <p
              id="vorlauf-hinweis"
              className={`mt-1 text-xs ${ergebnis.art === 'fehler' ? 'text-amber-700' : 'text-slate-500'}`}
            >
              {ergebnis.art === 'gut'
                ? vorlaufErklaerung(ergebnis.wert, settings ? settings.stichtage : {})
                : ergebnis.meldung}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || unveraendert || ergebnis.art === 'fehler'}
            className="w-full flex justify-center items-center min-h-[44px] py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Wird gespeichert...' : 'Vorlauf speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
