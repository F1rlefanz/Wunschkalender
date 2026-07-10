/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Gatekeeper } from './components/Gatekeeper';
import { Header } from './components/Header';
import { Calendar } from './components/Calendar';
import { api } from './api/client';
import { Wish, ShiftType, MonthlyComment } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [monthlyComments, setMonthlyComments] = useState<MonthlyComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMonthlyComments(currentMonth);
    }
  }, [currentMonth, isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getWishes();
      setWishes(data);
    } catch (error) {
      console.error('Failed to load wishes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyComments = async (month: string) => {
    try {
      const data = await api.getMonthlyComments(month);
      setMonthlyComments(data);
    } catch (error) {
      console.error('Failed to load monthly comments:', error);
    }
  };

  const handleAddWishes = async (dates: string[], shiftType: ShiftType, comment: string) => {
    if (!currentUser) return;
    
    try {
      const newWishes = await Promise.all(
        dates.map(date => api.addWish({
          employeeName: currentUser,
          date,
          shiftType,
          comment,
        }))
      );
      setWishes(prev => [...prev, ...newWishes]);
    } catch (error) {
      console.error('Failed to add wishes:', error);
      alert('Fehler beim Speichern der Wünsche.');
    }
  };

  const handleSaveMonthlyComment = async (month: string, text: string) => {
    if (!currentUser) return;
    try {
      const savedComment = await api.saveMonthlyComment({
        employeeName: currentUser,
        month,
        text
      });
      setMonthlyComments(prev => {
        const idx = prev.findIndex(c => c.employeeName === currentUser && c.month === month);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedComment;
          return next;
        }
        return [...prev, savedComment];
      });
    } catch (error) {
      console.error('Failed to save monthly comment:', error);
    }
  };

  if (!isAuthenticated) {
    return <Gatekeeper onSuccess={(userName) => {
      setCurrentUser(userName);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <Header 
        currentUser={currentUser} 
        onLogout={() => {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }}
      />
      
      <main>
        {loading && wishes.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Calendar 
            wishes={wishes} 
            monthlyComments={monthlyComments}
            currentUser={currentUser} 
            onAddWishes={handleAddWishes}
            onSaveMonthlyComment={handleSaveMonthlyComment}
            onMonthChange={setCurrentMonth}
          />
        )}
      </main>
    </div>
  );
}
