import { Calendar as CalendarIcon } from 'lucide-react';

interface HeaderProps {
  currentUser: string | null;
  onLogout: () => void;
}

export function Header({ currentUser, onLogout }: HeaderProps) {
  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-semibold tracking-tight">Wunschkalender</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentUser && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-300">Angemeldet als:</span>
                <span className="text-sm font-medium text-white bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
                  {currentUser}
                </span>
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
