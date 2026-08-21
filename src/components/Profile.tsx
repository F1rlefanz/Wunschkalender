import React, { useState } from 'react';
import { api } from '../api/client';
import { User, MIN_PASSWORD_LENGTH } from '../types';

interface ProfileProps {
  currentUser: User;
}

export function Profile({ currentUser }: ProfileProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Die Rueckmeldung steht bewusst im Formular und nicht in der schwebenden
  // Meldungszeile: Sie gehoert zu genau diesen beiden Feldern.
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await api.changePassword(currentUser.id, oldPassword, newPassword);
      if (response.success) {
        setMessage({ type: 'success', text: 'Passwort erfolgreich geändert.' });
        setOldPassword('');
        setNewPassword('');
      } else {
        setMessage({ type: 'error', text: response.message || 'Passwortänderung fehlgeschlagen.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-raum4 sm:p-raum5">
      <div className="bg-flaeche p-raum5 rounded-lg shadow-sm border border-rand max-w-md mx-auto">
        <h1 className="font-ueberschrift text-ueberschrift font-semibold mb-raum5">
          Profil und Sicherheit
        </h1>

        <div className="mb-raum5">
          <p className="text-klein text-leise mb-raum1">Angemeldet als</p>
          <p className="font-medium">
            {currentUser.name}{' '}
            <span className="ml-raum2 text-klein font-normal text-leise">
              ({currentUser.role === 'Manager' ? 'Leitung' : 'Mitarbeiter'})
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-raum4">
          <h2 className="border-b border-rand pb-raum2 font-ueberschrift font-medium">
            Passwort ändern
          </h2>

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
            <label htmlFor="altes-passwort" className="block text-klein font-medium mb-raum1">
              Altes Passwort
            </label>
            <input
              id="altes-passwort"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
          </div>

          <div>
            <label htmlFor="neues-passwort" className="block text-klein font-medium mb-raum1">
              Neues Passwort
            </label>
            <input
              id="neues-passwort"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-describedby="passwort-hinweis"
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
            <p
              id="passwort-hinweis"
              className={`mt-raum1 text-winzig ${
                newPassword && newPassword.length < MIN_PASSWORD_LENGTH
                  ? 'text-fehler-leise-text'
                  : 'text-leise'
              }`}
            >
              Mindestens {MIN_PASSWORD_LENGTH} Zeichen
              {newPassword && newPassword.length < MIN_PASSWORD_LENGTH
                ? ` — noch ${MIN_PASSWORD_LENGTH - newPassword.length} fehlen.`
                : '.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !oldPassword || newPassword.length < MIN_PASSWORD_LENGTH}
            className="w-full flex justify-center items-center min-h-11 rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief disabled:opacity-50"
          >
            {loading ? 'Wird gespeichert...' : 'Passwort aktualisieren'}
          </button>
        </form>
      </div>
    </div>
  );
}
