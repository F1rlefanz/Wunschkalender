import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User, MIN_PASSWORD_LENGTH } from '../types';
import { Edit2, Trash2, KeyRound, Plus, X } from 'lucide-react';
import { Bestaetigung, Dialog } from './Dialog';
import { useMeldung } from '../meldungen';

export function UserManagement() {
  const melde = useMeldung();
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

  // Wer geloescht bzw. wessen Passwort neu vergeben werden soll. Der Dialog
  // haengt an der Person, nicht an einem Merker: So steht ihr Name in der
  // Rueckfrage, und "Sicher?" bezieht sich auf jemand Bestimmtes.
  const [loeschKandidat, setLoeschKandidat] = useState<User | null>(null);
  const [passwortKandidat, setPasswortKandidat] = useState<User | null>(null);
  const [passwortNeu, setPasswortNeu] = useState('');
  const [passwortFehler, setPasswortFehler] = useState('');

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      setError('Fehler beim Laden der Benutzer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async () => {
    if (!loeschKandidat) return;
    const name = loeschKandidat.name;
    setLoeschKandidat(null);
    try {
      await api.deleteUser(loeschKandidat.id);
      await loadUsers();
      melde('gut', `${name} wurde gelöscht.`);
    } catch {
      melde('fehler', `${name} konnte nicht gelöscht werden.`);
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      await api.createUser({ name: newName, role: newRole, password: newPassword });
      setIsCreating(false);
      setNewName('');
      setNewPassword('');
      await loadUsers();
      melde('gut', `${newName} wurde angelegt.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    try {
      await api.updateUser(id, { name: editName, role: editRole });
      setIsEditing(null);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwortKandidat) return;
    setPasswortFehler('');
    try {
      const antwort = await api.resetUserPassword(passwortKandidat.id, passwortNeu);
      if (!antwort.success) {
        setPasswortFehler(antwort.message || 'Das Passwort konnte nicht geändert werden.');
        return;
      }
      const name = passwortKandidat.name;
      schliessePasswort();
      melde('gut', `Das Passwort für ${name} wurde neu vergeben.`);
    } catch {
      setPasswortFehler('Das Passwort konnte nicht geändert werden.');
    }
  };

  const schliessePasswort = () => {
    setPasswortKandidat(null);
    setPasswortNeu('');
    setPasswortFehler('');
  };

  const beginneBearbeiten = (user: User) => {
    setIsEditing(user.id);
    setEditName(user.name);
    setEditRole(user.role);
  };

  if (loading) return <p className="p-raum5 text-leise">Lade Benutzer...</p>;

  // Bewusst schlichte Funktionen, keine Komponenten: Eine im Rumpf definierte
  // Komponente bekommt bei jedem Rendern eine neue Identitaet, React haengt sie
  // neu ein — und das Eingabefeld im Bearbeiten-Formular verloere nach jedem
  // Tastendruck den Fokus.

  /** Die drei Icon-Knoepfe einer Zeile. */
  const aktionen = (user: User) => (
    <div className="flex items-center justify-end gap-raum2">
      <button
        type="button"
        onClick={() => setPasswortKandidat(user)}
        className="touchziel rounded-sm text-leise hover:text-marke hover:bg-flaeche-leise"
        // Der zugaengliche Name nennt die Person: "Passwort neu vergeben"
        // allein sagt in einer Liste von zwanzig Zeilen nicht, um wen es geht.
        aria-label={`Passwort für ${user.name} neu vergeben`}
        title="Passwort neu vergeben"
      >
        <KeyRound className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => beginneBearbeiten(user)}
        className="touchziel rounded-sm text-leise hover:text-marke hover:bg-flaeche-leise"
        aria-label={`${user.name} bearbeiten`}
        title="Bearbeiten"
      >
        <Edit2 className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setLoeschKandidat(user)}
        className="touchziel rounded-sm text-fehler hover:bg-fehler-leise"
        aria-label={`${user.name} löschen`}
        title="Löschen"
      >
        <Trash2 className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );

  const rolle = (user: User) => (
    <span
      className={`inline-block rounded-xs px-raum2 py-raum1 text-winzig font-medium ${
        user.role === 'Manager'
          ? 'bg-marke-leise text-marke-leise-text'
          : 'bg-flaeche-leise text-leise border border-rand'
      }`}
    >
      {user.role === 'Manager' ? 'Leitung' : 'Mitarbeiter'}
    </span>
  );

  const bearbeitenFelder = (user: User) => (
    <div className="flex flex-wrap items-center gap-raum2">
      <label className="sr-only" htmlFor={`name-${user.id}`}>
        Name
      </label>
      <input
        id={`name-${user.id}`}
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        className="min-h-11 flex-1 min-w-40 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
      />
      <label className="sr-only" htmlFor={`rolle-${user.id}`}>
        Rolle
      </label>
      <select
        id={`rolle-${user.id}`}
        value={editRole}
        onChange={(e) => setEditRole(e.target.value as 'Manager' | 'Employee')}
        className="min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum2 text-basis"
      >
        <option value="Employee">Mitarbeiter</option>
        <option value="Manager">Leitung</option>
      </select>
      <button
        type="button"
        onClick={() => handleUpdate(user.id)}
        className="touchziel rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief"
      >
        Speichern
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(null)}
        className="touchziel rounded-sm border border-rand-stark px-raum4 text-klein font-medium hover:bg-flaeche-leise"
      >
        Abbrechen
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-raum4 sm:p-raum5">
      <div className="bg-flaeche p-raum4 sm:p-raum5 rounded-lg shadow-sm border border-rand">
        <div className="flex flex-wrap justify-between items-center gap-raum3 mb-raum5">
          <h1 className="font-ueberschrift text-ueberschrift font-semibold">Benutzerverwaltung</h1>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="touchziel gap-raum2 rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Neuer Benutzer
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-raum4 rounded-sm border border-fehler bg-fehler-leise p-raum3 text-klein text-fehler-leise-text">
            {error}
          </p>
        )}

        {isCreating && (
          <div className="mb-raum5 rounded-sm border border-rand bg-flaeche-leise p-raum4">
            <h2 className="font-ueberschrift font-medium mb-raum3">Neuen Benutzer anlegen</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-raum4 md:items-end">
              <div>
                <label htmlFor="neuer-name" className="block text-klein font-medium mb-raum1">
                  Name
                </label>
                <input
                  id="neuer-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
                  placeholder="Vorname Nachname"
                />
              </div>
              <div>
                <label htmlFor="neue-rolle" className="block text-klein font-medium mb-raum1">
                  Rolle
                </label>
                <select
                  id="neue-rolle"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'Manager' | 'Employee')}
                  className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum2 text-basis"
                >
                  <option value="Employee">Mitarbeiter</option>
                  <option value="Manager">Leitung (Stationsleiter)</option>
                </select>
              </div>
              <div>
                <label htmlFor="initiales-passwort" className="block text-klein font-medium mb-raum1">
                  Initiales Passwort
                </label>
                <input
                  id="initiales-passwort"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-describedby="initiales-passwort-hinweis"
                  className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
                  placeholder="Passwort"
                />
                <p
                  id="initiales-passwort-hinweis"
                  className={`mt-raum1 text-winzig ${
                    newPassword && newPassword.length < MIN_PASSWORD_LENGTH
                      ? 'text-fehler-leise-text'
                      : 'text-leise'
                  }`}
                >
                  Mindestens {MIN_PASSWORD_LENGTH} Zeichen. Die Person kann es im Profil selbst
                  ändern.
                </p>
              </div>
              <div className="flex gap-raum2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || newPassword.length < MIN_PASSWORD_LENGTH}
                  className="touchziel flex-1 rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="touchziel rounded-sm border border-rand-stark hover:bg-flaeche"
                  aria-label="Anlegen abbrechen"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auf dem Telefon Karten statt Tabelle: Mit Beruehrzielen von 44 px
            passen Name, Rolle und drei Knoepfe nicht in eine Zeile von 360 px,
            und die Tabelle wuerde quer scrollen. */}
        <ul className="sm:hidden divide-y divide-rand">
          {users.map((user) => (
            <li key={user.id} className="py-raum3">
              {isEditing === user.id ? (
                bearbeitenFelder(user)
              ) : (
                <div className="flex items-center justify-between gap-raum3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    {rolle(user)}
                  </div>
                  {aktionen(user)}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-klein">
            <thead className="border-b border-rand bg-flaeche-leise text-winzig uppercase text-leise">
              <tr>
                <th scope="col" className="px-raum3 py-raum3">
                  Name
                </th>
                <th scope="col" className="px-raum3 py-raum3">
                  Rolle
                </th>
                <th scope="col" className="px-raum3 py-raum3 text-right">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-rand last:border-0">
                  {isEditing === user.id ? (
                    <td colSpan={3} className="px-raum3 py-raum3">
                      {bearbeitenFelder(user)}
                    </td>
                  ) : (
                    <>
                      <td className="px-raum3 py-raum2 font-medium">{user.name}</td>
                      <td className="px-raum3 py-raum2">
                        {rolle(user)}
                      </td>
                      <td className="px-raum3 py-raum2">
                        {aktionen(user)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Bestaetigung
        offen={loeschKandidat !== null}
        titel="Benutzer löschen"
        frage={
          loeschKandidat
            ? `${loeschKandidat.name} wird gelöscht — mit allen Wünschen und Hinweisen. Das lässt sich nicht rückgängig machen.`
            : ''
        }
        bestaetigenText="Endgültig löschen"
        onBestaetigen={handleDelete}
        onAbbrechen={() => setLoeschKandidat(null)}
      />

      <Dialog
        offen={passwortKandidat !== null}
        titel="Passwort neu vergeben"
        onSchliessen={schliessePasswort}
      >
        <form onSubmit={handleResetPassword} className="space-y-raum4">
          <p className="text-klein text-leise">
            Für <strong className="text-text">{passwortKandidat?.name}</strong>. Das neue Passwort
            gilt sofort; die Person kann es im Profil selbst ändern.
          </p>
          <div>
            <label htmlFor="neues-passwort" className="block text-klein font-medium mb-raum1">
              Neues Passwort
            </label>
            <input
              id="neues-passwort"
              type="text"
              value={passwortNeu}
              onChange={(e) => setPasswortNeu(e.target.value)}
              autoComplete="new-password"
              aria-describedby="neues-passwort-hinweis"
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
            <p id="neues-passwort-hinweis" className="mt-raum1 text-winzig text-leise">
              Mindestens {MIN_PASSWORD_LENGTH} Zeichen. Es steht im Klartext, damit es der Person
              weitergegeben werden kann.
            </p>
          </div>
          {passwortFehler && (
            <p
              role="alert"
              className="rounded-sm border border-fehler bg-fehler-leise p-raum3 text-klein text-fehler-leise-text"
            >
              {passwortFehler}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-raum2">
            <button
              type="button"
              onClick={schliessePasswort}
              className="touchziel rounded-sm border border-rand-stark px-raum4 text-klein font-medium hover:bg-flaeche-leise"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={passwortNeu.length < MIN_PASSWORD_LENGTH}
              className="touchziel rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief disabled:opacity-50"
            >
              Passwort setzen
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
