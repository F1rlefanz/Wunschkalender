import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, List, Users, Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Wish, ShiftType, MonthlyComment, User, Settings } from '../types';
import { Dialog } from './Dialog';
import { useMeldung } from '../meldungen';
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

/**
 * Grund- und Schriftfarbe je Schichtart. Die Farbe hilft beim Ueberfliegen,
 * sie traegt die Aussage aber nie allein: Im Feld steht immer der Buchstabe
 * bzw. der Name daneben.
 */
const SCHICHT_FARBE: Record<ShiftType, string> = {
  'Früh': 'bg-frueh text-frueh-text',
  'Spät': 'bg-spaet text-spaet-text',
  'Nacht': 'bg-nacht text-nacht-text',
  'Frei': 'bg-frei text-frei-text',
};

/**
 * Fuer die Punkte im Raster auf dem Telefon: Der zarte Flaechenton verschwindet
 * bei zehn Pixeln, deshalb steht dort der kraeftige Schriftton als Fuellung.
 */
const SCHICHT_PUNKT: Record<ShiftType, string> = {
  'Früh': 'bg-frueh-text',
  'Spät': 'bg-spaet-text',
  'Nacht': 'bg-nacht-text',
  'Frei': 'bg-frei-text',
};

const SCHICHT_KUERZEL: Record<ShiftType, string> = {
  'Früh': 'F',
  'Spät': 'S',
  'Nacht': 'N',
  'Frei': 'Fr',
};

const SCHICHTEN: ShiftType[] = ['Früh', 'Spät', 'Nacht', 'Frei'];

export function Calendar({ wishes, monthlyComments, currentUser, settings, users, onAddWishes, onDeleteWish, onSaveMonthlyComment, onMonthChange }: CalendarProps) {
  const melde = useMeldung();
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
  // Liste in den Einstellungen.
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
      melde('fehler', `Für ${monthYearString} sind keine Wunscheintragungen mehr möglich.`);
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

  // Auf dem Telefon ein schmalerer Aussenrand: Sonst bleiben fuer sieben Spalten
  // nur 43 px je Tag, und das Beruehrziel unterschreitet die 44 px.
  return (
    <div className="max-w-7xl mx-auto p-raum2 sm:p-raum5">
      {/* Monatskopf */}
      <div
        data-testid="monatskopf"
        data-monat={currentMonthStr}
        className="flex items-center justify-between gap-raum2 mb-raum5 bg-flaeche p-raum3 rounded-lg shadow-sm border border-rand"
      >
        <button
          type="button"
          onClick={prevMonth}
          className="touchziel rounded-xl text-leise hover:bg-flaeche-leise hover:text-text"
          aria-label="Voriger Monat"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="text-center min-w-0">
          <h1 className="font-ueberschrift text-titel font-semibold tracking-tight">{monthYearString}</h1>
          {frist && frist.stichtag && (
            <div className="mt-1 flex items-center justify-center gap-1">
              {/* Der Termin gehört sichtbar in den Monatskopf, nicht in eine
                  Absprache im Flur. */}
              <span
                className={`text-winzig font-medium px-raum2 py-raum1 rounded-xs border ${
                  frist.abgelaufen
                    ? 'text-fehler-leise-text bg-fehler-leise border-fehler'
                    : 'text-leise bg-flaeche-leise border-rand'
                }`}
              >
                {stichtagSatz(frist)}
                {frist.herkunft === 'gesetzt' && ' · fest'}
              </span>
              {currentUser?.role === 'Manager' && (
                <button
                  type="button"
                  onClick={oeffneStichtag}
                  aria-expanded={stichtagOffen}
                  aria-label={`Stichtag für ${monthYearString} ändern`}
                  className="touchziel rounded-xl text-leise hover:bg-flaeche-leise hover:text-text"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="touchziel rounded-xl text-leise hover:bg-flaeche-leise hover:text-text"
          aria-label="Nächster Monat"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Stichtag dieses Monats — nur für die Leitung */}
      {stichtagOffen && frist && currentUser?.role === 'Manager' && (
        <div className="mb-raum5 bg-flaeche p-raum4 rounded-lg shadow-sm border border-rand">
          <h2 className="font-ueberschrift font-semibold mb-raum1">Stichtag für {monthYearString}</h2>
          <p className="text-klein text-leise mb-raum3">
            Bis einschließlich zu diesem Tag können Mitarbeitende Wünsche eintragen. Ohne eigenen
            Stichtag gilt der automatische Vorschlag{vorschlag ? ` (${langesDatum(vorschlag)})` : ''}.
          </p>

          {stichtagFehler && (
            <p
              role="status"
              className="mb-raum3 rounded-sm border border-fehler bg-fehler-leise p-raum3 text-klein text-fehler-leise-text"
            >
              {stichtagFehler}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-raum2">
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
              className="flex-1 min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
            <button
              type="button"
              onClick={speichereStichtag}
              disabled={stichtagLaeuft || !stichtagEingabe}
              className="touchziel rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief disabled:opacity-50"
            >
              Speichern
            </button>
            {frist.herkunft === 'gesetzt' && (
              <button
                type="button"
                onClick={zurueckZurAutomatik}
                disabled={stichtagLaeuft}
                className="touchziel rounded-sm border border-rand-stark px-raum4 text-klein font-medium hover:bg-flaeche-leise disabled:opacity-50"
              >
                Automatik
              </button>
            )}
            <button
              type="button"
              onClick={() => setStichtagOffen(false)}
              disabled={stichtagLaeuft}
              className="touchziel rounded-sm px-raum4 text-klein font-medium text-leise hover:bg-flaeche-leise hover:text-text disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Ansichtswahl */}
      <div className="flex justify-center mb-raum5">
        <div
          className="inline-flex flex-wrap justify-center gap-raum1 p-raum1 bg-flaeche-leise rounded-lg border border-rand"
          role="group"
          aria-label="Ansicht wählen"
        >
          {(
            [
              ['grid', 'Kalender', CalendarIcon],
              ['list', 'Tagesliste', List],
              ['matrix', 'Mitarbeiter-Matrix', Users],
            ] as const
          ).map(([art, name, Symbol]) => (
            <button
              key={art}
              type="button"
              onClick={() => setViewType(art)}
              aria-pressed={viewType === art}
              className={`touchziel gap-raum2 rounded-sm px-raum3 text-klein font-medium transition-colors ${
                viewType === art
                  ? 'bg-flaeche text-text shadow-sm'
                  : 'text-leise hover:text-text'
              }`}
            >
              <Symbol className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Monthly Comments */}
      {currentUser && (
        <div className="mb-raum5 bg-flaeche p-raum4 rounded-lg shadow-sm border border-rand">
          <h2 className="font-ueberschrift font-semibold mb-raum3">
            Allgemeine Hinweise für {monthYearString}
          </h2>
          <div className="space-y-raum4">
            {hinweiseAnderer.map(c => {
              const u = users.find(user => user.id === c.userId);
              const name = u?.name || 'Unbekannt';

              return (
                <div key={c.id} className="bg-flaeche-leise p-raum3 rounded-sm border border-rand">
                  <span className="mb-raum1 block text-winzig font-semibold text-leise">{name}</span>
                  <p className="text-klein">{c.text}</p>
                </div>
              );
            })}

            {/* Das eigene Feld steht genau einmal da, ob schon etwas darin stand oder nicht. */}
            <div>
              <label htmlFor="eigener-hinweis" className="mb-raum1 block text-winzig font-semibold text-marke">
                {currentUser.name} (Sie)
              </label>
              <textarea
                id="eigener-hinweis"
                data-testid="monatshinweis"
                className="w-full rounded-sm border border-rand-stark bg-flaeche p-raum3 text-basis disabled:bg-flaeche-leise disabled:text-leise disabled:cursor-not-allowed"
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

      {/* Rasteransicht */}
      {viewType === 'grid' && (
        <div data-testid="ansicht" className="bg-flaeche rounded-lg shadow-sm border border-rand overflow-hidden">
          <div className="grid grid-cols-7 border-b border-rand bg-flaeche-leise">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
              <div
                key={d}
                className="py-raum2 text-center text-winzig font-semibold uppercase tracking-wider text-leise"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {Array.from({ length: emptyDays }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[76px] sm:min-h-[120px] border-b border-r border-rand bg-flaeche-leise/50"
              />
            ))}

            {days.map((day) => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayWishes = wishesByDate.get(dateStr) || [];

              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const isSelected = selectedDates.has(dateStr);
              const langname = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                day,
              ).toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              });
              const wunschZahl =
                dayWishes.length === 0
                  ? 'keine Wünsche'
                  : `${dayWishes.length} ${dayWishes.length === 1 ? 'Wunsch' : 'Wünsche'}`;

              return (
                <div
                  key={day}
                  data-testid={`tag-${dateStr}`}
                  className={`group relative min-h-[76px] sm:min-h-[120px] border-b border-r border-rand transition-colors ${
                    isSelected ? 'bg-marke-leise z-10' : ''
                  }`}
                >
                  {/* Die Auswahlflaeche liegt als eigener Knopf unter dem Inhalt,
                      statt die Zelle selbst zu einem Knopf zu machen: In der Zelle
                      stehen weitere Knoepfe, und ein Knopf im Knopf ist weder
                      gueltiges HTML noch mit der Tastatur bedienbar. */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => toggleDateSelection(dateStr)}
                      aria-pressed={isSelected}
                      aria-label={`${langname}, ${wunschZahl}`}
                      className={`absolute inset-0 w-full rounded-none ${
                        isSelected ? 'ring-2 ring-inset ring-marke' : 'hover:bg-flaeche-leise'
                      }`}
                    />
                  )}

                  <div className="pointer-events-none relative p-raum1 sm:p-raum2">
                    <div className="flex items-start justify-between">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-xl text-winzig font-medium sm:h-7 sm:w-7 sm:text-klein ${
                          isToday ? 'bg-marke text-marke-kontrast' : ''
                        } ${isSelected && !isToday ? 'text-marke-leise-text' : ''}`}
                      >
                        {day}
                      </span>
                      {isSelected && (
                        <span className="rounded-xl bg-marke p-raum1 text-marke-kontrast">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    {/* Wunschzettel ab Tablet: Name, Schicht, und der Loeschen-Knopf,
                        der sich nur bei Zeigergeraeten zurueckhaelt. */}
                    <div className="mt-raum2 hidden space-y-raum1 sm:block">
                      {dayWishes.slice(0, 3).map((wish) => {
                        const u = users.find((user) => user.id === wish.userId);
                        const name = u?.name || 'Unbekannt';
                        const canDelete = darfLoeschen(wish);

                        return (
                          <div
                            key={wish.id}
                            className={`pointer-events-auto flex items-center justify-between gap-raum1 rounded-xs px-raum2 py-raum1 text-winzig ${SCHICHT_FARBE[wish.shiftType]}`}
                            title={`${name}: ${wish.shiftType}${wish.comment ? ` – ${wish.comment}` : ''}`}
                          >
                            <span className="truncate">
                              <span className="font-semibold">{name.split(' ')[0]}</span>{' '}
                              <span className="opacity-80">({wish.shiftType})</span>
                            </span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteWish(wish.id)}
                                className="beim-zeigen shrink-0 rounded-xs p-raum1 hover:bg-flaeche/60"
                                aria-label={`Wunsch von ${name} am ${langname} löschen`}
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Ein Tag mit Wuenschen laesst sich oeffnen — auf dem Telefon
                        ist das der Weg zum Loeschen mit einem Ziel von 44 px, weil
                        dort keine Wunschzettel hinpassen. */}
                    {dayWishes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDayDetailsModal(dateStr)}
                        className="pointer-events-auto mt-raum1 flex min-h-11 w-full items-center justify-center gap-raum1 rounded-xs text-winzig font-medium text-leise hover:bg-flaeche-leise hover:text-text sm:min-h-0 sm:py-raum1"
                        aria-label={`Wünsche am ${langname} ansehen (${wunschZahl})`}
                      >
                        <span className="flex flex-wrap justify-center gap-raum1 sm:hidden">
                          {dayWishes.slice(0, 4).map((wish) => (
                            <span
                              key={wish.id}
                              className={`h-2.5 w-2.5 rounded-xl ${SCHICHT_PUNKT[wish.shiftType]}`}
                            />
                          ))}
                          {dayWishes.length > 4 && <span>+{dayWishes.length - 4}</span>}
                        </span>
                        <span className="hidden sm:inline">
                          {dayWishes.length > 3 ? `+ ${dayWishes.length - 3} weitere` : 'Ansehen'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tagesliste */}
      {viewType === 'list' && (
        <div data-testid="ansicht" className="space-y-raum4">
          {days.map((day) => {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWishes = wishesByDate.get(dateStr) || [];
            const langname = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              day,
            ).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

            return (
              <div
                key={day}
                className="bg-flaeche rounded-lg shadow-sm border border-rand p-raum4"
              >
                <div className="mb-raum4 flex flex-wrap items-center justify-between gap-raum3 border-b border-rand pb-raum3">
                  <div className="flex items-center gap-raum3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-flaeche-leise font-ueberschrift text-titel font-bold">
                      {day}
                    </span>
                    <div>
                      <h2 className="font-ueberschrift font-semibold">{langname}</h2>
                      <p className="text-winzig text-leise">
                        {dayWishes.length} {dayWishes.length === 1 ? 'Wunsch' : 'Wünsche'} insgesamt
                      </p>
                    </div>
                  </div>
                  {currentUser && !isMonthLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDates(new Set([dateStr]));
                        setIsModalOpen(true);
                      }}
                      className="touchziel gap-raum1 rounded-sm border border-marke px-raum3 text-klein font-medium text-marke hover:bg-marke-leise"
                      aria-label={`Wunsch für ${langname} eintragen`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Wunsch eintragen
                    </button>
                  )}
                </div>

                {dayWishes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-raum3 sm:grid-cols-2 md:grid-cols-4">
                    {SCHICHTEN.map((shift) => {
                      const shiftWishes = dayWishes.filter((w) => w.shiftType === shift);
                      return (
                        <div
                          key={shift}
                          className="rounded-sm border border-rand bg-flaeche-leise p-raum3"
                        >
                          <div className="mb-raum2 flex items-center justify-between gap-raum2">
                            <span
                              className={`rounded-xs px-raum2 py-raum1 text-winzig font-bold uppercase tracking-wider ${SCHICHT_FARBE[shift]}`}
                            >
                              {shift}
                            </span>
                            <span className="text-winzig font-semibold text-leise">
                              {shiftWishes.length}
                            </span>
                          </div>
                          {shiftWishes.length > 0 ? (
                            <ul className="space-y-raum2">
                              {shiftWishes.map((wish) => {
                                const u = users.find((user) => user.id === wish.userId);
                                const name = u?.name || 'Unbekannt';
                                const canDelete = darfLoeschen(wish);
                                return (
                                  <li
                                    key={wish.id}
                                    className="flex items-start justify-between gap-raum2 rounded-xs border border-rand bg-flaeche p-raum2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-klein font-semibold">{name}</p>
                                      {wish.comment && (
                                        <p className="mt-raum1 text-winzig text-leise">
                                          {wish.comment}
                                        </p>
                                      )}
                                    </div>
                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteWish(wish.id)}
                                        className="touchziel -m-raum2 shrink-0 rounded-sm text-fehler hover:bg-fehler-leise"
                                        aria-label={`Wunsch von ${name} am ${langname} löschen`}
                                        title="Löschen"
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="py-raum1 text-winzig text-leise">Keine Einträge</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-klein text-leise">Keine Wünsche für diesen Tag eingetragen.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mitarbeiter-Matrix */}
      {viewType === 'matrix' && (
        <div data-testid="ansicht" className="bg-flaeche rounded-lg shadow-sm border border-rand overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-raum3 border-b border-rand bg-flaeche-leise p-raum4">
            <div>
              <h2 className="font-ueberschrift font-semibold">Mitarbeiter-Wunschmatrix</h2>
              <p className="text-winzig text-leise">
                Gesamtübersicht über alle Wünsche des Monats. Auf schmalen Geräten seitlich scrollbar.
              </p>
            </div>
            <ul className="flex flex-wrap gap-raum2 text-winzig font-semibold text-leise">
              {SCHICHTEN.map((shift) => (
                <li key={shift} className="flex items-center gap-raum1">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-xs text-winzig font-bold ${SCHICHT_FARBE[shift]}`}
                    aria-hidden="true"
                  >
                    {SCHICHT_KUERZEL[shift]}
                  </span>
                  {shift}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative max-h-[600px] overflow-auto">
            {/* Kein `min-width` auf der Tabelle und schmale Tagesspalten: Mit
                36 px je Spalte brauchten 31 Tage plus Namensspalte 1266 px und
                die Matrix scrollte quer, obwohl die Karte 1240 px breit war.
                Jetzt passt der Monat auf dem Desktop hinein; auf dem Telefon
                scrollt sie weiterhin, dort geht es nicht anders. */}
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rand bg-flaeche-leise text-winzig font-semibold uppercase tracking-wider text-leise">
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-30 w-[9rem] min-w-[9rem] border-r border-rand bg-flaeche-leise p-raum2"
                  >
                    Mitarbeiter
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      className="sticky top-0 z-20 min-w-[1.75rem] border-r border-rand bg-flaeche-leise p-raum1 text-center"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rand">
                {matrixUsers.map((user) => (
                  <tr key={user.id}>
                    <th
                      scope="row"
                      className="sticky left-0 border-r border-rand bg-flaeche p-raum2 text-left text-klein font-semibold"
                    >
                      <span className="block truncate" title={user.name}>
                        {user.name}
                      </span>
                      {user.role === 'Manager' && (
                        <span className="mt-raum1 inline-block rounded-xs bg-marke-leise px-raum1 text-winzig font-bold text-marke-leise-text">
                          Leitung
                        </span>
                      )}
                    </th>
                    {days.map((day) => {
                      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const userWish = wishes.find(
                        (w) => w.userId === user.id && w.date === dateStr,
                      );

                      return (
                        <td
                          key={day}
                          className="min-w-[1.75rem] border-r border-rand p-0.5 text-center text-winzig"
                        >
                          {userWish ? (
                            <span
                              className={`mx-auto flex h-7 w-7 flex-col items-center justify-center rounded-xs font-bold ${SCHICHT_FARBE[userWish.shiftType]}`}
                              title={`${user.name}: ${userWish.shiftType}${userWish.comment ? ` – ${userWish.comment}` : ''}`}
                            >
                              {SCHICHT_KUERZEL[userWish.shiftType]}
                              {userWish.comment && (
                                <span
                                  className="mt-0.5 h-1 w-1 rounded-xl bg-current"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="sr-only">
                                {`${userWish.shiftType}${userWish.comment ? `, Kommentar: ${userWish.comment}` : ''}`}
                              </span>
                            </span>
                          ) : (
                            <span className="text-leise" aria-label="kein Wunsch">
                              ·
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leiste fuer die Mehrfachauswahl, am unteren Rand in Daumenreichweite.
          Die Meldungen haengen deshalb oben unter der Kopfzeile. */}
      {selectedDates.size > 0 && (
        <div
          role="region"
          aria-label="Ausgewählte Tage"
          className="fixed bottom-raum4 left-raum3 right-raum3 z-40 flex items-center justify-between gap-raum3 rounded-lg bg-leiste px-raum3 py-raum2 text-leiste-text shadow-xl leistenbereich md:left-1/2 md:right-auto md:-translate-x-1/2"
        >
          <span className="whitespace-nowrap text-klein font-semibold">
            {selectedDates.size} Tag{selectedDates.size > 1 ? 'e' : ''}{' '}
            <span className="hidden sm:inline">ausgewählt</span>
          </span>
          <div className="flex items-center gap-raum2">
            <button
              type="button"
              onClick={() => setSelectedDates(new Set())}
              className="touchziel rounded-sm px-raum3 text-klein font-semibold text-leiste-leise hover:bg-leiste-aktiv hover:text-leiste-text"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              // Markenrot erreicht auf dem Anthrazit der Leiste nur 2.88:1. Der
              // weisse Umriss macht die Kante des Knopfes trotzdem eindeutig.
              className="touchziel gap-raum1 whitespace-nowrap rounded-sm border border-leiste-text bg-marke px-raum4 text-klein font-semibold text-marke-kontrast hover:bg-marke-tief"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Wunsch eintragen</span>
              <span className="sm:hidden">Eintragen</span>
            </button>
          </div>
        </div>
      )}

      <Dialog
        offen={isModalOpen}
        titel={`Wunsch eintragen (${selectedDates.size} Tag${selectedDates.size > 1 ? 'e' : ''})`}
        onSchliessen={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleAddSubmit} className="space-y-raum4">
          <div>
            <label htmlFor="schichtart" className="block text-klein font-medium mb-raum1">
              Schichtart
            </label>
            <select
              id="schichtart"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as ShiftType)}
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum2 text-basis"
            >
              <option value="Früh">Frühschicht</option>
              <option value="Spät">Spätschicht</option>
              <option value="Nacht">Nachtschicht</option>
              <option value="Frei">Frei</option>
            </select>
          </div>

          <div>
            <label htmlFor="wunsch-kommentar" className="block text-klein font-medium mb-raum1">
              Kommentar (optional)
            </label>
            <input
              id="wunsch-kommentar"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="z.B. Arzttermin"
              className="w-full min-h-11 rounded-sm border border-rand-stark bg-flaeche px-raum3 text-basis"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-raum2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="touchziel rounded-sm border border-rand-stark px-raum4 text-klein font-medium hover:bg-flaeche-leise"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="touchziel rounded-sm bg-marke px-raum4 text-klein font-medium text-marke-kontrast hover:bg-marke-tief"
            >
              Speichern
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        offen={dayDetailsModal !== null}
        titel={
          dayDetailsModal
            ? `Wünsche für den ${dayDetailsModal.split('-').reverse().join('.')}`
            : ''
        }
        onSchliessen={() => setDayDetailsModal(null)}
        breit
      >
        {['Früh', 'Spät', 'Nacht', 'Frei'].map((shift) => {
          const shiftWishes = (wishesByDate.get(dayDetailsModal ?? '') || []).filter(
            (w) => w.shiftType === shift,
          );
          if (shiftWishes.length === 0) return null;
          return (
            <div key={shift} className="mb-raum5 last:mb-0">
              <h3 className="mb-raum3 flex items-center gap-raum2 text-klein font-semibold uppercase tracking-wider text-leise">
                {shift === 'Frei' ? 'Frei' : `${shift}schicht`}
                <span className="rounded-xl bg-flaeche-leise px-raum2 py-raum1 text-winzig text-text">
                  {shiftWishes.length}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-raum3">
                {shiftWishes.map((wish) => {
                  const u = users.find((user) => user.id === wish.userId);
                  const canDelete = darfLoeschen(wish);
                  return (
                    <div
                      key={wish.id}
                      className="flex items-start justify-between gap-raum2 rounded-sm border border-rand bg-flaeche p-raum3"
                    >
                      <div className="min-w-0">
                        <p className="text-klein font-medium">{u?.name || 'Unbekannt'}</p>
                        {wish.comment && (
                          <p className="mt-raum1 text-winzig text-leise">{wish.comment}</p>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteWish(wish.id)}
                          className="touchziel -m-raum2 shrink-0 rounded-sm text-fehler hover:bg-fehler-leise"
                          aria-label={`Wunsch von ${u?.name || 'Unbekannt'} löschen`}
                          title="Wunsch löschen"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {(wishesByDate.get(dayDetailsModal ?? '') || []).length === 0 && (
          <p className="py-raum6 text-center text-leise">Keine Wünsche für diesen Tag eingetragen.</p>
        )}
      </Dialog>

    </div>
  );
}
