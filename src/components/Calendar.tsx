import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, List, X } from 'lucide-react';
import { Wish, ShiftType, MonthlyComment, User, Settings } from '../types';

interface CalendarProps {
  wishes: Wish[];
  monthlyComments: MonthlyComment[];
  currentUser: User | null;
  settings: Settings | null;
  users: User[];
  onAddWishes: (dates: string[], shift: ShiftType, comment: string) => void;
  onDeleteWish: (id: string) => void;
  onSaveMonthlyComment: (month: string, text: string) => void;
  onMonthChange: (month: string) => void;
}

export function Calendar({ wishes, monthlyComments, currentUser, settings, users, onAddWishes, onDeleteWish, onSaveMonthlyComment, onMonthChange }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localMonthlyComment, setLocalMonthlyComment] = useState('');
  const [dayDetailsModal, setDayDetailsModal] = useState<string | null>(null);
  
  // Modal state
  const [shiftType, setShiftType] = useState<ShiftType>('Früh');
  const [comment, setComment] = useState('');

  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    onMonthChange(currentMonthStr);
    const myComment = monthlyComments.find(c => c.userId === currentUser?.id && c.month === currentMonthStr);
    setLocalMonthlyComment(myComment?.text || '');
  }, [currentDate, monthlyComments, currentUser, currentMonthStr]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  // Adjust for Monday start
  const emptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthYearString = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // Filter visibility based on role
  const visibleWishes = useMemo(() => {
    if (currentUser?.role === 'Employee') {
      return wishes.filter(w => w.userId === currentUser.id);
    }
    return wishes;
  }, [wishes, currentUser]);

  const visibleMonthlyComments = useMemo(() => {
    if (currentUser?.role === 'Employee') {
      return monthlyComments.filter(c => c.userId === currentUser.id);
    }
    return monthlyComments;
  }, [monthlyComments, currentUser]);

  // Map wishes by date string
  const wishesByDate = useMemo(() => {
    const map = new Map<string, Wish[]>();
    visibleWishes.forEach(w => {
      const existing = map.get(w.date) || [];
      map.set(w.date, [...existing, w]);
    });
    return map;
  }, [visibleWishes]);

  // Determine if booking is locked for the displayed month
  const isMonthLocked = useMemo(() => {
    if (!settings || !currentUser) return false;
    if (currentUser.role === 'Manager') return false; // Managers bypass locks
    
    const now = new Date();
    const currentMonthTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const displayedMonthTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    
    // If displayed month is in the past, locked.
    if (displayedMonthTime < currentMonthTime) return true;
    
    // If displayed month is exactly next month, and today is past deadline, locked.
    if (
      currentDate.getFullYear() === now.getFullYear() &&
      currentDate.getMonth() === now.getMonth() + 1
    ) {
      if (now.getDate() >= settings.bookingDeadlineDay) {
        return true;
      }
    }
    return false;
  }, [currentDate, settings, currentUser]);

  const toggleDateSelection = (dateStr: string) => {
    if (isMonthLocked) {
      alert(`Wunscheintragung für diesen Monat ist seit dem ${settings?.bookingDeadlineDay}. gesperrt.`);
      return;
    }
    const newSelection = new Set(selectedDates);
    if (newSelection.has(dateStr)) {
      newSelection.delete(dateStr);
    } else {
      newSelection.add(dateStr);
    }
    setSelectedDates(newSelection);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDates.size > 0 && currentUser) {
      onAddWishes(Array.from(selectedDates), shiftType, comment);
      setSelectedDates(new Set());
      setIsModalOpen(false);
      setComment('');
      setShiftType('Früh');
    }
  };

  const hasCurrentUserComment = monthlyComments.some(c => c.userId === currentUser?.id);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{monthYearString}</h2>
          {isMonthLocked && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 mt-1 inline-block">Gesperrt</span>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Monthly Comments */}
      {currentUser && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Allgemeine Hinweise für {monthYearString}</h3>
          <div className="space-y-4">
            {visibleMonthlyComments.map(c => {
              const u = users.find(user => user.id === c.userId);
              const name = u?.name || 'Unbekannt';
              
              return c.userId === currentUser.id ? (
                <div key={c.id}>
                  <span className="text-xs font-semibold text-blue-600 mb-1 block">{name} (Sie)</span>
                  <textarea
                    className="w-full border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-sm"
                    rows={2}
                    value={localMonthlyComment}
                    onChange={(e) => setLocalMonthlyComment(e.target.value)}
                    onBlur={() => onSaveMonthlyComment(currentMonthStr, localMonthlyComment)}
                    placeholder='Z.B. "Max. 3 Nachtdienste pro Monat" oder "Urlaub vom 12. bis 15."'
                  />
                </div>
              ) : (
                <div key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 mb-1 block">{name}</span>
                  <p className="text-sm text-slate-800">{c.text}</p>
                </div>
              );
            })}
            
            {/* If current user hasn't added a comment yet */}
            {!hasCurrentUserComment && (
              <div>
                <span className="text-xs font-semibold text-blue-600 mb-1 block">{currentUser.name} (Sie)</span>
                <textarea
                  className="w-full border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-sm"
                  rows={2}
                  value={localMonthlyComment}
                  onChange={(e) => setLocalMonthlyComment(e.target.value)}
                  onBlur={() => onSaveMonthlyComment(currentMonthStr, localMonthlyComment)}
                  placeholder='Z.B. "Max. 3 Nachtdienste pro Monat" oder "Urlaub vom 12. bis 15."'
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
            <div key={d} className="py-3 text-center text-sm font-medium text-slate-500">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 auto-rows-fr">
          {Array.from({ length: emptyDays }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[120px] p-2 border-b border-r border-slate-100 bg-slate-50/50" />
          ))}
          
          {days.map(day => {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWishes = wishesByDate.get(dateStr) || [];
            
            const freiCount = dayWishes.filter(w => w.shiftType === 'Frei').length;
            const isConflict = freiCount > 1 || dayWishes.length > 2;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const isSelected = selectedDates.has(dateStr);

            return (
              <div 
                key={day} 
                onClick={() => {
                  if (currentUser) {
                    toggleDateSelection(dateStr);
                  }
                }}
                className={`min-h-[120px] p-2 border-b border-r border-slate-100 relative transition-colors cursor-pointer 
                  ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : 
                    isConflict ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'} ${isSelected ? 'bg-blue-100 text-blue-700' : ''}`}>
                    {day}
                  </span>
                  <div className="flex items-center space-x-1">
                    {currentUser?.role === 'Manager' && dayWishes.length > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDayDetailsModal(dateStr); }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Tagesdetails anzeigen"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    )}
                    {isSelected && (
                      <div className="p-1 text-blue-600 bg-blue-100 rounded-full">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {dayWishes.slice(0, 3).map(wish => {
                    const u = users.find(user => user.id === wish.userId);
                    const name = u?.name || 'Unbekannt';
                    const canDelete = currentUser?.role === 'Manager' || currentUser?.id === wish.userId;

                    return (
                      <div 
                        key={wish.id} 
                        className={`text-xs px-2 py-1 flex items-center justify-between rounded truncate border relative group ${
                          wish.shiftType === 'Frei' 
                            ? isConflict ? 'bg-red-100 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                        title={`${name}: ${wish.shiftType} - ${wish.comment || ''}`}
                      >
                        <div className="flex items-center truncate">
                          <span className="font-semibold truncate">{name.split(' ')[0]}</span>
                          <span className="opacity-75 ml-1 flex-shrink-0">({wish.shiftType})</span>
                        </div>
                        {canDelete && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteWish(wish.id);
                            }}
                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity ml-2 focus:outline-none"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {dayWishes.length > 3 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDayDetailsModal(dateStr); }}
                      className="text-[10px] w-full text-center py-1 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-medium transition-colors border border-slate-200"
                    >
                      + {dayWishes.length - 3} weitere
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Bar for Multi-Select */}
      {selectedDates.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center space-x-6 z-40 animate-in slide-in-from-bottom-10 fade-in duration-200">
          <span className="font-medium whitespace-nowrap">{selectedDates.size} Tag{selectedDates.size > 1 ? 'e' : ''} ausgewählt</span>
          <div className="flex space-x-3">
            <button 
              onClick={() => setSelectedDates(new Set())}
              className="text-slate-300 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Abbrechen
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors shadow-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Wunsch eintragen
            </button>
          </div>
        </div>
      )}

      {/* Add Wish Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Wunsch eintragen ({selectedDates.size} Tag{selectedDates.size > 1 ? 'e' : ''})
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schichtart</label>
                <select 
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as ShiftType)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                >
                  <option value="Früh">Frühschicht</option>
                  <option value="Spät">Spätschicht</option>
                  <option value="Nacht">Nachtschicht</option>
                  <option value="Frei">Frei</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kommentar (optional)</label>
                <input 
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="z.B. Arzttermin"
                  className="w-full border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {dayDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">
                Wünsche für den {dayDetailsModal.split('-').reverse().join('.')}
              </h3>
              <button 
                onClick={() => setDayDetailsModal(null)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {['Früh', 'Spät', 'Nacht', 'Frei'].map(shift => {
                const shiftWishes = (wishesByDate.get(dayDetailsModal) || []).filter(w => w.shiftType === shift);
                if (shiftWishes.length === 0) return null;
                return (
                  <div key={shift} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center uppercase tracking-wider">
                      {shift} {shift !== 'Frei' && 'schicht'} 
                      <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                        {shiftWishes.length}
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {shiftWishes.map(wish => {
                        const u = users.find(user => user.id === wish.userId);
                        const canDelete = currentUser?.role === 'Manager' || currentUser?.id === wish.userId;
                        return (
                          <div key={wish.id} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-start shadow-sm">
                            <div>
                              <div className="font-medium text-slate-900 text-sm">{u?.name || 'Unbekannt'}</div>
                              {wish.comment && <div className="text-xs text-slate-500 mt-1">{wish.comment}</div>}
                            </div>
                            {canDelete && (
                              <button 
                                onClick={() => onDeleteWish(wish.id)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Wunsch löschen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {(wishesByDate.get(dayDetailsModal) || []).length === 0 && (
                <div className="text-center text-slate-500 py-8">
                  Keine Wünsche für diesen Tag eingetragen.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
