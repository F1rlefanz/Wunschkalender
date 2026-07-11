import { Calendar as CalendarIcon, Download, Users, User as UserIcon, LogOut } from 'lucide-react';
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
    <header className="bg-slate-950 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2 mr-3 sm:mr-4 cursor-pointer" onClick={() => onNavigate('calendar')}>
              <CalendarIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight">Wunschkalender</h1>
            </div>
            
            {currentUser && (
              <nav className="flex space-x-1 sm:space-x-2">
                <button
                  onClick={() => onNavigate('calendar')}
                  className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center ${currentView === 'calendar' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                  title="Kalender"
                >
                  <CalendarIcon className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Kalender</span>
                </button>
                {isManager && (
                  <button
                    onClick={() => onNavigate('users')}
                    className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center ${currentView === 'users' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                    title="Benutzerverwaltung"
                  >
                    <Users className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Benutzer</span>
                  </button>
                )}
              </nav>
            )}
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {canExport && currentView === 'calendar' && (
              <button
                onClick={onExport}
                className="flex items-center text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-colors shadow-sm"
                title="Als PDF exportieren"
              >
                <Download className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {currentUser && (
              <button
                onClick={() => onNavigate('profile')}
                className={`flex items-center text-xs font-semibold text-white px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border transition-colors shadow-sm ${
                  currentView === 'profile' ? 'ring-2 ring-blue-500' : ''
                } ${
                  currentUser.role === 'Employee' ? 'bg-emerald-800/80 border-emerald-700/80 hover:bg-emerald-700' :
                  currentUser.role === 'Manager' ? 'bg-indigo-800/80 border-indigo-700/80 hover:bg-indigo-700' :
                  'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
                }`}
                title="Profil & Passwort"
              >
                <UserIcon className="w-3.5 h-3.5 sm:mr-1.5 flex-shrink-0" />
                <span className="max-w-[65px] sm:max-w-[120px] truncate">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span className="hidden md:inline ml-1 opacity-75 text-[10px]">({currentUser.role === 'Manager' ? 'Leitung' : 'Mitarbeiter'})</span>
              </button>
            )}
            
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-900 transition-colors flex items-center"
              title="Abmelden"
            >
              <LogOut className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
