import React, { useState } from 'react';
import { api } from '../api/client';
import { Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Anmeldung</h2>
          <p className="text-slate-500 text-sm mt-2 text-center">
            Bitte geben Sie Ihren Namen und Ihr Passwort ein.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="name"
                type="text"
                autoComplete="username"
                autoCapitalize="words"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vorname Nachname"
                className="block w-full min-h-[44px] pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full min-h-[44px] px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !password}
            className="w-full flex justify-center items-center min-h-[44px] py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Bitte warten...' : 'Anmelden'}
          </button>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Passwort vergessen? Die Stationsleitung kann Ihnen in der
            Benutzerverwaltung ein neues setzen.
          </p>
        </form>
      </div>
    </div>
  );
}
