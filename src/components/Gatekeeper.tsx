import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface GatekeeperProps {
  onSuccess: (user: User) => void;
}

export function Gatekeeper({ onSuccess }: GatekeeperProps) {
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Password reset state
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [simulatedTokenMsg, setSimulatedTokenMsg] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await api.getUsers();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Bitte wählen Sie Ihren Namen aus.');
      return;
    }
    setLoading(true);
    setError('');

    if (mode === 'login') {
      try {
        const response = await api.login(userId, password);
        if (response.success && response.user) {
          onSuccess(response.user);
        } else {
          setError(response.message || 'Falsches Passwort.');
        }
      } catch (err) {
        setError('Fehler bei der Anmeldung.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'forgot') {
      try {
        const response = await api.requestPasswordReset(userId);
        if (response.success) {
          setSimulatedTokenMsg(`Simulierte E-Mail: Ihr Reset-Token lautet ${response.simulatedEmailToken}`);
          setMode('reset');
        } else {
          setError(response.message || 'Fehler beim Anfordern des Reset-Tokens.');
        }
      } catch (err) {
        setError('Fehler beim Anfordern des Reset-Tokens.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'reset') {
      if (!resetToken || !newPassword) {
        setError('Bitte füllen Sie alle Felder aus.');
        setLoading(false);
        return;
      }
      try {
        const response = await api.resetPassword(userId, resetToken, newPassword);
        if (response.success) {
          alert('Passwort erfolgreich zurückgesetzt. Sie können sich nun anmelden.');
          setMode('login');
          setPassword('');
          setResetToken('');
          setNewPassword('');
          setSimulatedTokenMsg('');
        } else {
          setError(response.message || 'Fehler beim Zurücksetzen.');
        }
      } catch (err) {
        setError('Fehler beim Zurücksetzen des Passworts.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loadingUsers) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {mode === 'login' ? 'Anmeldung' : mode === 'forgot' ? 'Passwort vergessen' : 'Passwort zurücksetzen'}
          </h2>
          <p className="text-slate-500 text-sm mt-2 text-center">
            {mode === 'login' && 'Bitte wählen Sie Ihren Namen aus und geben Sie Ihr Passwort ein.'}
            {mode === 'forgot' && 'Wählen Sie Ihren Namen aus, um einen Reset-Token anzufordern.'}
            {mode === 'reset' && 'Geben Sie den Reset-Token und Ihr neues Passwort ein.'}
          </p>
        </div>

        {simulatedTokenMsg && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-800 text-sm rounded-md border border-blue-200">
            {simulatedTokenMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {(mode === 'login' || mode === 'forgot') && (
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-slate-700">
                Wer sind Sie?
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none bg-white"
                >
                  <option value="" disabled>Bitte Namen auswählen...</option>
                  {users.map(user => {
                    return (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ausgewählter Benutzer</label>
              <div className="px-3 py-2 bg-slate-100 rounded-md text-sm text-slate-600 border border-slate-200">
                {users.find(u => u.id === userId)?.name || 'Unbekannt'}
              </div>
            </div>
          )}

          {mode === 'login' && (
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
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); }}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Passwort vergessen?
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label htmlFor="resetToken" className="block text-sm font-medium text-slate-700">
                  Reset-Token
                </label>
                <input
                  id="resetToken"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm tracking-widest font-mono"
                  placeholder="123456"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                  Neues Passwort
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••"
                />
              </div>
            </>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || (!userId && mode !== 'reset')}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Bitte warten...' : mode === 'login' ? 'Eintreten' : mode === 'forgot' ? 'Token anfordern' : 'Passwort zurücksetzen'}
          </button>

          {(mode === 'forgot' || mode === 'reset') && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSimulatedTokenMsg(''); }}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Zurück zur Anmeldung
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
