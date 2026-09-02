import React, { useState } from 'react';
import { api } from '../api/client';
import { Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { BeispielZugangsdaten } from './Testfassung';

interface GatekeeperProps {
  onSuccess: (user: User) => void;
}

export function Gatekeeper({ onSuccess }: GatekeeperProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.login(name, password);
      if (response.success && response.user) {
        onSuccess(response.user);
      } else {
        setError(response.message || 'Anmeldung fehlgeschlagen.');
      }
    } catch {
      setError('Der Server ist nicht erreichbar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hintergrund flex items-center justify-center p-raum4">
      <div className="max-w-md w-full bg-flaeche rounded-lg shadow-lg p-raum5 border border-rand">
        <div className="flex flex-col items-center mb-raum6">
          <div className="w-12 h-12 bg-marke-leise rounded-full flex items-center justify-center mb-raum4">
            <Lock className="w-6 h-6 text-marke-leise-text" aria-hidden="true" />
          </div>
          <h1 className="font-ueberschrift text-gross font-semibold tracking-tight">Anmeldung</h1>
          <p className="text-leise text-klein mt-raum2 text-center">
            Bitte geben Sie Ihren Namen und Ihr Passwort ein.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-raum5">
          <div>
            <label htmlFor="name" className="block text-klein font-medium">
              Name
            </label>
            <div className="mt-raum1 relative">
              <div className="absolute inset-y-0 left-0 pl-raum3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-leise" aria-hidden="true" />
              </div>
              <input
                id="name"
                type="text"
                autoComplete="username"
                autoCapitalize="words"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vorname Nachname"
                className="block w-full min-h-11 pl-10 pr-raum4 py-raum2 bg-flaeche border border-rand-stark rounded-sm text-basis"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-klein font-medium">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-raum1 block w-full min-h-11 px-raum4 py-raum2 bg-flaeche border border-rand-stark rounded-sm text-basis"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-klein bg-fehler-leise text-fehler-leise-text border border-fehler rounded-sm p-raum3"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !password}
            className="w-full flex justify-center items-center min-h-11 py-raum2 px-raum4 rounded-sm text-klein font-medium bg-marke text-marke-kontrast hover:bg-marke-tief disabled:opacity-50 transition-colors"
          >
            {loading ? 'Bitte warten...' : 'Anmelden'}
          </button>

          <p className="text-winzig text-leise text-center">
            Passwort vergessen? Die Stationsleitung kann Ihnen in der
            Benutzerverwaltung ein neues setzen.
          </p>
        </form>

        {/* Nur in der Testfassung. Ein Klick auf einen Namen traegt ihn ein;
            das Passwort steht darueber und ist fuer alle dasselbe. */}
        <BeispielZugangsdaten
          onWaehlen={(gewaehlt) => {
            setName(gewaehlt);
            setError('');
          }}
        />
      </div>
    </div>
  );
}
