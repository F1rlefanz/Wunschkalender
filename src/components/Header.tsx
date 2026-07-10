import { Calendar as CalendarIcon, Download, Users, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  currentView: 'calendar' | 'users' | 'profile';
  onNavigate: (view: 'calendar' | 'users' | 'profile') => void;
  onLogout: () => void;
  onExport: () => void;
}

export function Header({ currentUser, currentView, onNavigate, onLogout, onExport }: HeaderProps) {
  const canExport = currentUser?.role === 'Manager';
  const isManager = currentUser?.role === 'Manager';

  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-semibold tracking-tight cursor-pointer" onClick={() => onNavigate('calendar')}>Wunschkalender</h1>
            
            {currentUser && (
              <nav className="hidden md:flex ml-8 space-x-4">
                <button
                  onClick={() => onNavigate('calendar')}
                  className={`text-sm px-3 py-2 rounded-md transition-colors ${currentView === 'calendar' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                >
                  <div className="flex items-center"><CalendarIcon className="w-4 h-4 mr-2"/> Kalender</div>
                </button>
                {isManager && (
                  <button
                    onClick={() => onNavigate('users')}
                    className={`text-sm px-3 py-2 rounded-md transition-colors ${currentView === 'users' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  >
                    <div className="flex items-center"><Users className="w-4 h-4 mr-2"/> Benutzer</div>
                  </button>
                )}
              </nav>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {canExport && currentView === 'calendar' && (
              <button
                onClick={onExport}
                className="flex items-center text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md transition-colors"
                title="Als PDF exportieren"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            )}

            {currentUser && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onNavigate('profile')}
                  className={`flex items-center text-sm font-medium text-white px-3 py-1.5 rounded-md border transition-colors ${
                    currentView === 'profile' ? 'ring-2 ring-blue-500 ' : ''
                  }${
                    currentUser.role === 'Employee' ? 'bg-red-800 border-red-700 hover:bg-red-700' :
                    currentUser.role === 'Manager' ? 'bg-indigo-800 border-indigo-700 hover:bg-indigo-700' :
                    'bg-slate-800 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="Profil & Passwort"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  {currentUser.name} ({currentUser.role})
                </button>
              </div>
            )}
            
            <button
              onClick={onLogout}
              className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
