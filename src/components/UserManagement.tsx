import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User } from '../types';
import { Edit2, Trash2, KeyRound, Plus, X } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'Manager' | 'Employee'>('Employee');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'Manager' | 'Employee'>('Employee');
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Fehler beim Laden der Benutzer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Sicher, dass dieser Benutzer gelöscht werden soll?')) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err) {
      alert('Fehler beim Löschen');
    }
  };

  const handleCreate = async () => {
    try {
      await api.createUser({ name: newName, role: newRole, password: newPassword });
      setIsCreating(false);
      setNewName('');
      setNewPassword('');
      await loadUsers();
    } catch (err) {
      alert('Fehler beim Erstellen');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.updateUser(id, { name: editName, role: editRole });
      setIsEditing(null);
      await loadUsers();
    } catch (err) {
      alert('Fehler beim Speichern');
    }
  };

  const handleResetPassword = async (id: string) => {
    const newPwd = prompt('Bitte neues Passwort für den Benutzer eingeben:');
    if (!newPwd) return;
    try {
      await api.updateUser(id, { password: newPwd });
      alert('Passwort erfolgreich geändert.');
    } catch (err) {
      alert('Fehler beim Ändern des Passworts.');
    }
  };

  if (loading) return <div>Lade Benutzer...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Benutzerverwaltung</h2>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Neuer Benutzer
          </button>
        )}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {isCreating && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="font-medium mb-3">Neuen Benutzer anlegen</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Rolle</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="Employee">Mitarbeiter</option>
                <option value="Manager">Leitung (Stationsleiter)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Initiales Passwort</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Passwort" />
            </div>
            <div className="flex space-x-2">
              <button onClick={handleCreate} disabled={!newName} className="bg-emerald-600 text-white px-3 py-2 rounded-md text-sm hover:bg-emerald-700 w-full disabled:opacity-50">Speichern</button>
              <button onClick={() => setIsCreating(false)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-sm hover:bg-slate-300"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  {isEditing === user.id ? (
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="px-2 py-1 border rounded w-full" />
                  ) : user.name}
                </td>
                <td className="px-4 py-3">
                  {isEditing === user.id ? (
                    <select value={editRole} onChange={e => setEditRole(e.target.value as any)} className="px-2 py-1 border rounded w-full">
                      <option value="Employee">Mitarbeiter</option>
                      <option value="Manager">Leitung</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'Manager' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                      {user.role === 'Manager' ? 'Leitung' : 'Mitarbeiter'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {isEditing === user.id ? (
                    <>
                      <button onClick={() => handleUpdate(user.id)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Speichern</button>
                      <button onClick={() => setIsEditing(null)} className="text-slate-500 hover:text-slate-700 text-xs font-medium">Abbrechen</button>
                    </>
                  ) : (
                    <div className="flex items-center justify-end space-x-3">
                      <button onClick={() => handleResetPassword(user.id)} title="Passwort neu vergeben" className="text-amber-500 hover:text-amber-700"><KeyRound className="w-4 h-4" /></button>
                      <button onClick={() => { setIsEditing(user.id); setEditName(user.name); setEditRole(user.role); }} title="Bearbeiten" className="text-blue-500 hover:text-blue-700"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(user.id)} title="Löschen" className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
