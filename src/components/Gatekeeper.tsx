import { useState } from 'react';
import { api } from '../api/client';
import { Lock, User } from 'lucide-react';
import { EMPLOYEE_NAMES } from '../types';

interface GatekeeperProps {
  onSuccess: (userName: string) => void;
}

export function Gatekeeper({ onSuccess }: GatekeeperProps) {
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName) {
      setError('Bitte wählen Sie Ihren Namen aus.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const isValid = await api.verifyPassword(password);
      if (isValid) {
        onSuccess(userName);
      } else {
        setError('Falsches Passwort. Bitte erneut versuchen.');
      }
    } catch (err) {
      setError('Fehler bei der Überprüfung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Geschützter Bereich</h2>
          <p className="text-slate-500 text-sm mt-2 text-center">
            Bitte geben Sie das Zugangspasswort ein, um den Wunschkalender zu öffnen. (Tipp: demo123)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-slate-700">
              Wer sind Sie?
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <select
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="block w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none bg-white"
              >
                <option value="" disabled>Bitte Namen auswählen...</option>
                {EMPLOYEE_NAMES.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="••••••"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !password || !userName}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Prüfung...' : 'Eintreten'}
          </button>
        </form>
      </div>
    </div>
  );
}
