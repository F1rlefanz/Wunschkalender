/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Gatekeeper } from './components/Gatekeeper';
import { Header, type Ansicht } from './components/Header';
import { Calendar } from './components/Calendar';
import { UserManagement } from './components/UserManagement';
import { Profile } from './components/Profile';
import { Einstellungen } from './components/Einstellungen';
import { api } from './api/client';
import { Wish, ShiftType, MonthlyComment, User, Settings } from './types';
import { MeldungsBereich, Meldungen, useMeldung } from './meldungen';
import { io } from 'socket.io-client';
import { Testfassungsstreifen } from './components/Testfassung';

/**
 * Der Meldungsbereich liegt um die ganze Anwendung, damit auch der
 * Anmeldebildschirm und tief liegende Komponenten `useMeldung()` benutzen
 * koennen, ohne die Funktion durchzureichen.
 */
export default function App() {
  return (
    <MeldungsBereich>
      {/* Ueber allem, auch ueber der Anmeldung: Wer hier landet, soll wissen,
          dass die Daten erfunden sind, bevor er etwas eintippt. */}
      <Testfassungsstreifen />
      <Anwendung />
      <Meldungen />
    </MeldungsBereich>
  );
}

function Anwendung() {
  const melde = useMeldung();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<Ansicht>('calendar');
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [monthlyComments, setMonthlyComments] = useState<MonthlyComment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [checkingSession, setCheckingSession] = useState(true);
  const [exportLaeuft, setExportLaeuft] = useState(false);

  // Beim Start fragen, wer angemeldet ist. Ohne das erschiene nach jedem
  // Neuladen wieder der Anmeldebildschirm, obwohl die Sitzung noch gilt.
  useEffect(() => {
    api
      .me()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    setLoading(true);
    const socket = io();

    api.getUsers().then(setUsers).catch(console.error);

    socket.on('init', (data: { wishes: Wish[], monthlyComments: MonthlyComment[], settings: Settings }) => {
      setWishes(data.wishes);
      setMonthlyComments(data.monthlyComments);
      setSettings(data.settings);
      setLoading(false);
    });

    socket.on('settings_updated', (newSettings: Settings) => {
      setSettings(newSettings);
    });

    socket.on('users_updated', (newUsers: User[]) => {
      setUsers(newUsers);
    });

    socket.on('wish_added', (wish: Wish) => {
      setWishes(prev => {
        if (prev.find(w => w.id === wish.id)) return prev;
        return [...prev, wish];
      });
    });

    socket.on('wish_deleted', (id: string) => {
      setWishes(prev => prev.filter(w => w.id !== id));
    });

    socket.on('monthly_comment_added', (comment: MonthlyComment) => {
      setMonthlyComments(prev => {
        if (prev.find(c => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    });

    socket.on('monthly_comment_updated', (comment: MonthlyComment) => {
      setMonthlyComments(prev => prev.map(c => c.id === comment.id ? comment : c));
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated]);

  const handleAddWishes = async (dates: string[], shiftType: ShiftType, comment: string) => {
    if (!currentUser) return;
    
    try {
      await Promise.all(
        dates.map(date => api.addWish({ date, shiftType, comment }))
      );
    } catch (error) {
      console.error('Failed to add wishes:', error);
      melde('fehler', 'Die Wünsche konnten nicht gespeichert werden.');
    }
  };

  const handleDeleteWish = async (id: string) => {
    try {
      await api.deleteWish(id);
    } catch (error) {
      console.error('Failed to delete wish:', error);
      melde('fehler', 'Der Wunsch konnte nicht gelöscht werden.');
    }
  };

  const handleSaveMonthlyComment = async (month: string, text: string) => {
    if (!currentUser) return;
    try {
      await api.saveMonthlyComment({ month, text });
    } catch (error) {
      // Bisher blieb das stumm: Der Hinweis stand weiter im Feld, war aber
      // nicht gespeichert.
      console.error('Failed to save monthly comment:', error);
      melde('fehler', 'Der Hinweis konnte nicht gespeichert werden. Bitte noch einmal versuchen.');
    }
  };

  // Der PDF-Bau liegt in `pdf.ts` und wird erst beim Klick geladen:
  // `jspdf` samt `html2canvas` waere sonst im Erststart jedes Telefons, obwohl
  // nur die Leitung exportiert. Waehrend des Ladens zeigt der Knopf das an —
  // im Mobilfunknetz dauert es sichtbar lange.
  const handleExport = async () => {
    if (exportLaeuft) return;
    setExportLaeuft(true);
    try {
      const { erzeugePdf } = await import('./pdf');
      erzeugePdf(currentMonth, wishes, users, monthlyComments);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      melde('fehler', 'Der Export konnte nicht erstellt werden. Bitte noch einmal versuchen.');
    } finally {
      setExportLaeuft(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-hintergrund flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marke" role="status" aria-label="Anmeldung wird geprüft" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Gatekeeper onSuccess={(user) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="min-h-screen bg-hintergrund pb-raum7">
      <Header 
        currentUser={currentUser} 
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={async () => {
          await api.logout().catch(() => undefined);
          setIsAuthenticated(false);
          setCurrentUser(null);
          setCurrentView('calendar');
        }}
        onExport={handleExport}
        exportLaeuft={exportLaeuft}
      />
      
      <main className="py-raum5">
        {loading ? (
          <div className="flex items-center justify-center p-raum7">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marke" role="status" aria-label="Daten werden geladen" />
          </div>
        ) : (
          <>
            {currentView === 'calendar' && (
              <Calendar 
                wishes={wishes} 
                monthlyComments={monthlyComments}
                currentUser={currentUser} 
                settings={settings}
                users={users}
                onAddWishes={handleAddWishes}
                onDeleteWish={handleDeleteWish}
                onSaveMonthlyComment={handleSaveMonthlyComment}
                onMonthChange={setCurrentMonth}
              />
            )}
            
            {currentView === 'users' && currentUser?.role === 'Manager' && (
              <UserManagement />
            )}
            
            {currentView === 'settings' && currentUser?.role === 'Manager' && (
              <Einstellungen settings={settings} />
            )}

            {currentView === 'profile' && currentUser && (
              <Profile currentUser={currentUser} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
