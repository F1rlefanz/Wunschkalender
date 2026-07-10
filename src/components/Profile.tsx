import { useState } from 'react';
import { api } from '../api/client';
import { User } from '../types';

interface ProfileProps {
  currentUser: User;
}

export function Profile({ currentUser }: ProfileProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
    } catch (err) {
      setMessage({ type: 'error', text: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Profil & Sicherheit</h2>
      
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-1">Angemeldet als</p>
        <p className="font-medium text-slate-900">{currentUser.name} <span className="text-sm font-normal text-slate-500 ml-2">({currentUser.role})</span></p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-sm font-medium text-slate-800 border-b pb-2">Passwort ändern</h3>
        
        {message && (
          <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Altes Passwort</label>
          <input 
            type="password" 
            value={oldPassword} 
            onChange={e => setOldPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Neues Passwort</label>
          <input 
            type="password" 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !oldPassword || !newPassword}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Wird gespeichert...' : 'Passwort aktualisieren'}
        </button>
      </form>
    </div>
    </div>
  );
}
