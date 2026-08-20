/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Gatekeeper } from './components/Gatekeeper';
import { Header } from './components/Header';
import { Calendar } from './components/Calendar';
import { UserManagement } from './components/UserManagement';
import { Profile } from './components/Profile';
import { api } from './api/client';
import { Wish, ShiftType, MonthlyComment, User, Settings } from './types';
import { hinweisZeilen, monatDE, wunschZeilen } from './export';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'users' | 'profile'>('calendar');
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
      alert('Fehler beim Speichern der Wünsche.');
    }
  };

  const handleDeleteWish = async (id: string) => {
    try {
      await api.deleteWish(id);
    } catch (error) {
      console.error('Failed to delete wish:', error);
      alert('Fehler beim Löschen des Wunsches.');
    }
  };

  const handleSaveMonthlyComment = async (month: string, text: string) => {
    if (!currentUser) return;
    try {
      await api.saveMonthlyComment({ month, text });
    } catch (error) {
      console.error('Failed to save monthly comment:', error);
    }
  };

  const handleExport = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Wunschkalender - ${monatDE(currentMonth)}`, 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [['Datum', 'Name', 'Schicht', 'Kommentar']],
      body: wunschZeilen(wishes, users, currentMonth),
    });

    // Die Monatshinweise stehen hinter den Wuenschen, nicht davor: Sonst
    // schoebe ein hinweisreicher Monat die Wunschtabelle auf die zweite Seite.
    const hinweise = hinweisZeilen(monthlyComments, users, currentMonth);
    if (hinweise.length > 0) {
      const nachTabelle = (doc as any).lastAutoTable?.finalY ?? 30;
      doc.setFontSize(12);
      doc.text('Monatshinweise', 14, nachTabelle + 12);
      autoTable(doc, {
        startY: nachTabelle + 16,
        head: [['Name', 'Hinweis']],
        body: hinweise,
        // Der Hinweis bekommt den Rest der Breite und wird umbrochen statt
        // abgeschnitten; lange Hinweise bleiben so lesbar.
        columnStyles: { 0: { cellWidth: 40 } },
      });
    }

    doc.save(`Wunschkalender_${currentMonth}.pdf`);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
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
      />
      
      <main className="py-6">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            
            {currentView === 'profile' && currentUser && (
              <Profile currentUser={currentUser} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
