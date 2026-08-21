import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, List, X, Users, Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Wish, ShiftType, MonthlyComment, User, Settings } from '../types';
import { automatischerStichtag, sperrfristFuerMonat, stichtagSatz } from '../sperrfrist';
import { langesDatum } from '../einstellungen';
import { api } from '../api/client';
import { eigenerHinweis, fremdeHinweise, uebernehmeServerstand } from '../hinweise';

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
  // Zuletzt aus den Daten uebernommener Feldinhalt: unterscheidet fremde
  // Aktualisierungen von eigenem, noch ungespeichertem Text.
  const uebernommenerHinweis = useRef({ schluessel: '', text: '' });
  const [dayDetailsModal, setDayDetailsModal] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'grid' | 'list' | 'matrix'>('grid');
  
  // Modal state
  const [shiftType, setShiftType] = useState<ShiftType>('Früh');
  const [comment, setComment] = useState('');

  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const matrixUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  useEffect(() => {
    onMonthChange(currentMonthStr);
  }, [currentMonthStr]);

  const meinHinweis = useMemo(
    () => eigenerHinweis(monthlyComments, currentMonthStr, currentUser),
    [monthlyComments, currentMonthStr, currentUser],
  );

  const hinweisSchluessel = `${currentUser?.id ?? ''}|${currentMonthStr}`;

  useEffect(() => {
    const ergebnis = uebernehmeServerstand({
      schluessel: hinweisSchluessel,
      serverText: meinHinweis?.text ?? '',
      feldText: localMonthlyComment,
      uebernommen: uebernommenerHinweis.current,
    });
    uebernommenerHinweis.current = ergebnis.uebernommen;
    if (ergebnis.feldText !== localMonthlyComment) setLocalMonthlyComment(ergebnis.feldText);
  }, [meinHinweis, hinweisSchluessel, localMonthlyComment]);

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

  const hinweiseAnderer = useMemo(
    () => fremdeHinweise(monthlyComments, currentMonthStr, currentUser),
    [monthlyComments, currentMonthStr, currentUser],
  );

  // Map wishes by date string
  const wishesByDate = useMemo(() => {
    const map = new Map<string, Wish[]>();
    visibleWishes.forEach(w => {
      const existing = map.get(w.date) || [];
      map.set(w.date, [...existing, w]);
    });
    return map;
  }, [visibleWishes]);

  // Dieselbe Funktion, die auch der Server benutzt. Zwei getrennte Fassungen
  // waeren hier ein Fehler: Der Client zeigte sonst Eingaben an, die der Server
  // ablehnt — oder umgekehrt.
  const frist = useMemo(() => {
    if (!settings || !currentUser) return null;
    return sperrfristFuerMonat({
      monat: currentMonthStr,
      vorlaufTage: settings.vorlaufTage,
      stichtage: settings.stichtage,
      rolle: currentUser.role,
    });
  }, [currentMonthStr, settings, currentUser]);

  const isMonthLocked = frist ? frist.gesperrt : false;

  // Was gaelte, wenn dieser Monat keinen eigenen Stichtag haette. Nur zur
  // Erklaerung im Bearbeitungsfeld.
  const vorschlag = useMemo(
    () => automatischerStichtag(currentMonthStr, settings ? settings.vorlaufTage : undefined),
    [currentMonthStr, settings],
  );

  // Der Stichtag dieses einen Monats, von der Leitung gesetzt. Der Monat ist
  // der, den sie gerade ansieht — deshalb steht das hier und nicht in einer
  // Liste in den Einstellungen (#36).
  const [stichtagOffen, setStichtagOffen] = useState(false);
  const [stichtagEingabe, setStichtagEingabe] = useState('');
  const [stichtagLaeuft, setStichtagLaeuft] = useState(false);
  const [stichtagFehler, setStichtagFehler] = useState<string | null>(null);

  // Ein Monatswechsel schliesst das Feld: Sonst stuende die Eingabe des einen
  // Monats ueber der Ueberschrift eines anderen.
  useEffect(() => {
    setStichtagOffen(false);
    setStichtagFehler(null);
  }, [currentMonthStr]);

  const oeffneStichtag = () => {
    setStichtagEingabe(frist && frist.stichtag ? frist.stichtag : '');
    setStichtagFehler(null);
    setStichtagOffen(true);
  };

  // Beide Wege schreiben nur; der neue Stand kommt ueber `settings_updated`
  // zurueck — wie ueberall sonst auch.
  const speichereStichtag = async () => {
    setStichtagLaeuft(true);
    setStichtagFehler(null);
    try {
      await api.setStichtag(currentMonthStr, stichtagEingabe);
      setStichtagOffen(false);
    } catch (fehler: any) {
      setStichtagFehler(fehler?.message || 'Der Stichtag konnte nicht gespeichert werden.');
    } finally {
      setStichtagLaeuft(false);
    }
  };

  const zurueckZurAutomatik = async () => {
    setStichtagLaeuft(true);
    setStichtagFehler(null);
    try {
      await api.loescheStichtag(currentMonthStr);
      setStichtagOffen(false);
    } catch (fehler: any) {
      setStichtagFehler(fehler?.message || 'Der Stichtag konnte nicht zurückgenommen werden.');
    } finally {
      setStichtagLaeuft(false);
    }
  };

  // Im gesperrten Monat lehnt der Server auch das Loeschen ab. Ohne diese
  // Bedingung stuende der Knopf da und liefe jedes Mal in eine Fehlermeldung.
  const darfLoeschen = (wish: Wish) =>
    !isMonthLocked && (currentUser?.role === 'Manager' || currentUser?.id === wish.userId);

  const toggleDateSelection = (dateStr: string) => {
    if (isMonthLocked) {
      alert(`Für ${monthYearString} sind keine Wunscheintragungen mehr möglich.`);
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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{monthYearString}</h2>
          {frist && frist.stichtag && (
            <div className="mt-1 flex items-center justify-center gap-1">
              {/* Der Termin gehört sichtbar in den Monatskopf, nicht in eine
                  Absprache im Flur (#36). */}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  frist.abgelaufen
                    ? 'text-red-600 bg-red-50 border-red-100'
                    : 'text-slate-600 bg-slate-50 border-slate-200'
                }`}
              >
                {stichtagSatz(frist)}
                {frist.herkunft === 'gesetzt' && ' · fest'}
              </span>
              {currentUser?.role === 'Manager' && (
                <button
                  onClick={oeffneStichtag}
                  aria-expanded={stichtagOffen}
                  aria-label={`Stichtag für ${monthYearString} ändern`}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Stichtag dieses Monats — nur für die Leitung */}
      {stichtagOffen && frist && currentUser?.role === 'Manager' && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Stichtag für {monthYearString}</h3>
          <p className="text-xs text-slate-500 mb-3">
            Bis einschließlich zu diesem Tag können Mitarbeitende Wünsche eintragen. Ohne eigenen
            Stichtag gilt der automatische Vorschlag{vorschlag ? ` (${langesDatum(vorschlag)})` : ''}.
          </p>

          {stichtagFehler && (
            <p role="status" className="mb-3 p-3 rounded text-sm bg-red-50 text-red-700">
              {stichtagFehler}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="stichtag" className="sr-only">
              Stichtag für {monthYearString}
            </label>
            <input
              id="stichtag"
              type="date"
              value={stichtagEingabe}
              onChange={(e) => {
                setStichtagEingabe(e.target.value);
                setStichtagFehler(null);
              }}
              className="flex-1 min-h-[44px] px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            />
            <button
              onClick={speichereStichtag}
              disabled={stichtagLaeuft || !stichtagEingabe}
              className="min-h-[44px] px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              Speichern
            </button>
            {frist.herkunft === 'gesetzt' && (
              <button
                onClick={zurueckZurAutomatik}
                disabled={stichtagLaeuft}
                className="min-h-[44px] px-4 rounded-md text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                Automatik
              </button>
            )}
            <button
              onClick={() => setStichtagOffen(false)}
              disabled={stichtagLaeuft}
              className="min-h-[44px] px-4 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* View Switcher */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setViewType('grid')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              viewType === 'grid' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Kalender</span>
          </button>
          <button
            onClick={() => setViewType('list')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              viewType === 'list' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Tagesliste</span>
          </button>
          <button
            onClick={() => setViewType('matrix')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              viewType === 'matrix' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Mitarbeiter-Matrix</span>
          </button>
        </div>
      </div>

      {/* Monthly Comments */}
      {currentUser && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Allgemeine Hinweise für {monthYearString}</h3>
          <div className="space-y-4">
            {hinweiseAnderer.map(c => {
              const u = users.find(user => user.id === c.userId);
              const name = u?.name || 'Unbekannt';

              return (
                <div key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 mb-1 block">{name}</span>
                  <p className="text-sm text-slate-800">{c.text}</p>
                </div>
              );
            })}

            {/* Das eigene Feld steht genau einmal da, ob schon etwas darin stand oder nicht. */}
            <div>
              <span className="text-xs font-semibold text-blue-600 mb-1 block">{currentUser.name} (Sie)</span>
              <textarea
                className="w-full border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                rows={2}
                value={localMonthlyComment}
                disabled={isMonthLocked}
                onChange={(e) => setLocalMonthlyComment(e.target.value)}
                onBlur={() => {
                  if (localMonthlyComment === (meinHinweis?.text ?? '')) return;
                  onSaveMonthlyComment(currentMonthStr, localMonthlyComment);
                }}
                placeholder='Z.B. "Max. 3 Nachtdienste pro Monat" oder "Urlaub vom 12. bis 15."'
              />
            </div>
          </div>
        </div>
      )}

      {/* Views Container */}
      {viewType === 'grid' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
              <div key={d} className="py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 auto-rows-fr">
            {Array.from({ length: emptyDays }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-slate-100 bg-slate-50/50" />
            ))}
            
            {days.map(day => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayWishes = wishesByDate.get(dateStr) || [];
              
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
                  className={`min-h-[70px] sm:min-h-[120px] p-1.5 sm:p-2 border-b border-r border-slate-100 relative transition-all cursor-pointer select-none
                    ${isSelected ? 'bg-blue-50/75 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs sm:text-sm font-medium w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'} ${isSelected ? 'bg-blue-100 text-blue-700' : ''}`}>
                      {day}
                    </span>
                    <div className="flex items-center space-x-0.5 sm:space-x-1">
                      {currentUser?.role === 'Manager' && dayWishes.length > 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDayDetailsModal(dateStr); }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Tagesdetails anzeigen"
                        >
                          <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      )}
                      {isSelected && (
                        <div className="p-0.5 sm:p-1 text-blue-600 bg-blue-100 rounded-full">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Wishes List (Large Screens Only) */}
                  <div className="hidden sm:block mt-2 space-y-1">
                    {dayWishes.slice(0, 3).map(wish => {
                      const u = users.find(user => user.id === wish.userId);
                      const name = u?.name || 'Unbekannt';
                      const canDelete = darfLoeschen(wish);

                      return (
                        <div 
                          key={wish.id} 
                          className={`text-xs px-2 py-1 flex items-center justify-between rounded truncate border relative group ${
                            wish.shiftType === 'Frei'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
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

                  {/* Mobile Compact Indicators (Mobile Screens Only - Prevents Overflow) */}
                  <div className="sm:hidden mt-2 flex flex-col items-center">
                    {dayWishes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center max-w-full">
                        {dayWishes.slice(0, 4).map(wish => (
                          <span 
                            key={wish.id}
                            className={`w-2 h-2 rounded-full border border-white shadow-sm flex-shrink-0 ${
                              wish.shiftType === 'Früh' ? 'bg-blue-500' :
                              wish.shiftType === 'Spät' ? 'bg-amber-500' :
                              wish.shiftType === 'Nacht' ? 'bg-indigo-600' :
                              'bg-emerald-500'
                            }`}
                            title={`${wish.shiftType}`}
                          />
                        ))}
                        {dayWishes.length > 4 && (
                          <span className="text-[9px] font-bold text-slate-500 leading-none">+{dayWishes.length - 4}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewType === 'list' && (
        <div className="space-y-4">
          {days.map(day => {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWishes = wishesByDate.get(dateStr) || [];
            
            return (
              <div key={day} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-base sm:text-lg font-bold text-slate-800 bg-slate-100 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg">
                      {day}
                    </span>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm sm:text-base">
                        {new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {dayWishes.length} {dayWishes.length === 1 ? 'Wunsch' : 'Wünsche'} insgesamt
                      </p>
                    </div>
                  </div>
                  {currentUser && !isMonthLocked && (
                    <button
                      onClick={() => {
                        setSelectedDates(new Set([dateStr]));
                        setIsModalOpen(true);
                      }}
                      className="flex items-center text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Wunsch eintragen
                    </button>
                  )}
                </div>

                {dayWishes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {(['Früh', 'Spät', 'Nacht', 'Frei'] as ShiftType[]).map(shift => {
                      const shiftWishes = dayWishes.filter(w => w.shiftType === shift);
                      return (
                        <div key={shift} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100/80">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              shift === 'Früh' ? 'bg-blue-100 text-blue-800' :
                              shift === 'Spät' ? 'bg-amber-100 text-amber-800' :
                              shift === 'Nacht' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {shift}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100/50 px-1.5 py-0.2 rounded-full">{shiftWishes.length}</span>
                          </div>
                          {shiftWishes.length > 0 ? (
                            <ul className="space-y-1.5">
                              {shiftWishes.map(wish => {
                                const u = users.find(user => user.id === wish.userId);
                                const canDelete = darfLoeschen(wish);
                                return (
                                  <li key={wish.id} className="text-sm bg-white p-2 rounded border border-slate-100 flex justify-between items-start shadow-sm">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-800 truncate text-xs sm:text-sm">{u?.name || 'Unbekannt'}</p>
                                      {wish.comment && (
                                        <p className="text-xs text-slate-500 mt-0.5 italic">{wish.comment}</p>
                                      )}
                                    </div>
                                    {canDelete && (
                                      <button
                                        onClick={() => onDeleteWish(wish.id)}
                                        className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-50 transition-colors ml-1"
                                        title="Löschen"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-400 italic py-1">Keine Einträge</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-400 italic">Keine Wünsche für diesen Tag eingetragen.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix View */}
      {viewType === 'matrix' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm sm:text-base">Mitarbeiter-Wunschmatrix</h4>
              <p className="text-xs text-slate-500">Gesamtübersicht über alle Wünsche des Monats. Scrollen Sie horizontal und vertikal.</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-slate-600">
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-blue-500 mr-1.5" /> F (Früh)</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-amber-500 mr-1.5" /> S (Spät)</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-indigo-600 mr-1.5" /> N (Nacht)</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-emerald-500 mr-1.5" /> Frei</span>
            </div>
          </div>
          <div className="overflow-auto max-h-[600px] relative">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] sm:text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="sticky left-0 top-0 bg-slate-100 p-3 z-30 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] min-w-[150px] sm:min-w-[180px]">
                    Mitarbeiter
                  </th>
                  {days.map(day => (
                    <th key={day} className="sticky top-0 bg-slate-100 p-2 text-center border-r border-slate-200 min-w-[32px] sm:min-w-[36px] z-20">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixUsers.map(user => {
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="sticky left-0 bg-white p-2.5 sm:p-3 font-semibold text-slate-800 border-r border-slate-200 text-xs sm:text-sm shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <div className="truncate max-w-[140px] sm:max-w-[170px]" title={user.name}>
                          {user.name}
                        </div>
                        {user.role === 'Manager' && (
                          <span className="inline-block mt-0.5 text-[9px] bg-indigo-50 text-indigo-600 px-1 py-0.2 rounded font-bold" title="Leitung">L</span>
                        )}
                      </td>
                      {days.map(day => {
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const userWish = wishes.find(w => w.userId === user.id && w.date === dateStr);
                        
                        return (
                          <td key={day} className="p-0.5 sm:p-1 border-r border-slate-200 text-center text-xs min-w-[32px] sm:min-w-[36px]">
                            {userWish ? (
                              <div 
                                className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto flex flex-col items-center justify-center rounded-lg font-bold text-[10px] sm:text-xs transition-transform hover:scale-110 cursor-help ${
                                  userWish.shiftType === 'Früh' ? 'bg-blue-500 text-white shadow-sm' :
                                  userWish.shiftType === 'Spät' ? 'bg-amber-500 text-white shadow-sm' :
                                  userWish.shiftType === 'Nacht' ? 'bg-indigo-600 text-white shadow-sm' :
                                  'bg-emerald-500 text-white shadow-sm'
                                }`}
                                title={`${user.name}: ${userWish.shiftType}${userWish.comment ? ` - ${userWish.comment}` : ''}`}
                              >
                                {userWish.shiftType === 'Früh' ? 'F' :
                                 userWish.shiftType === 'Spät' ? 'S' :
                                 userWish.shiftType === 'Nacht' ? 'N' : 'Fr'}
                                {userWish.comment && (
                                  <span className="w-1 h-1 bg-white rounded-full mt-0.5" />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-200 font-normal select-none">•</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Action Bar for Multi-Select */}
      {selectedDates.size > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-4 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-slate-950 text-white px-3 py-2.5 sm:px-6 sm:py-4 rounded-xl sm:rounded-full shadow-2xl flex items-center justify-between gap-2 sm:gap-6 z-40 animate-in slide-in-from-bottom-10 fade-in duration-200">
          <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">
            {selectedDates.size} Tag{selectedDates.size > 1 ? 'e' : ''} <span className="hidden sm:inline">ausgewählt</span>
          </span>
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            <button 
              onClick={() => setSelectedDates(new Set())}
              className="text-slate-400 hover:text-white px-2 py-1.5 text-xs sm:text-sm font-semibold transition-colors"
            >
              Abbrechen
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-full text-xs sm:text-sm font-semibold transition-colors shadow-sm flex items-center whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
              <span className="hidden sm:inline">Wunsch eintragen</span>
              <span className="sm:hidden">Eintragen</span>
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
                        const canDelete = darfLoeschen(wish);
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
