import { Calendar as CalendarIcon, Download, Users, User as UserIcon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { User } from '../types';

export type Ansicht = 'calendar' | 'users' | 'profile' | 'settings';

interface HeaderProps {
  currentUser: User | null;
  currentView: Ansicht;
  onNavigate: (view: Ansicht) => void;
  onLogout: () => void;
  onExport: () => void;
}

/**
 * Die Kopfzeile traegt die rote Leiste des Hauses — das Erkennungszeichen des
 * Corporate Designs (#21). Zwei Regeln folgen daraus:
 *
 * - Auf Markenrot besteht **nur Weiss** den Kontrast von 4.5:1. Es gibt hier
 *   keinen gedaempften Textton; die Rangfolge macht das Schriftgewicht.
 * - **Keine zweite Rotflaeche**, auch nicht fuer Zeigen oder den aktuellen
 *   Weg. Jeder zweite Rotton beisst sich mit dem Markenrot — ein dunklerer
 *   erst recht. Struktur machen deshalb weisse Unterstriche und Umrisse; die
 *   Umriss-Knoepfe kehren sich beim Zeigen um (weiss gefuellt, rote Schrift).
 *
 * Sie traegt vier Wege; ein fuenfter passt auf 360 px nicht mehr ohne Umbau.
 */
export function Header({ currentUser, currentView, onNavigate, onLogout, onExport }: HeaderProps) {
  const canExport = currentUser?.role === 'Manager';
  const isManager = currentUser?.role === 'Manager';

  return (
    <header className="kopfbereich bg-kopf text-kopf-text shadow-md">
      <div className="max-w-7xl mx-auto px-raum3 sm:px-raum5">
        <div className="flex justify-between items-center gap-raum2 min-h-16 py-raum2">
          <div className="flex items-center min-w-0 gap-raum2">
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="touchziel gap-raum2 rounded-sm px-raum1"
              title="Zum Kalender"
            >
              <CalendarIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {/* Der Name weicht auf dem Telefon: Er ist Beschriftung, die
                  Navigationspunkte dahinter sind Zugang. Das Logo bleibt als
                  Weg zurueck zum Kalender. */}
              <span className="hidden sm:block font-ueberschrift text-titel font-bold tracking-tight">
                Wunschkalender
              </span>
              <span className="sr-only sm:hidden">Wunschkalender</span>
            </button>

            {currentUser && (
              <nav aria-label="Hauptnavigation" className="flex items-center gap-raum2">
                {/* Auf dem Telefon weicht dieser Weg — nicht der Zugang: Das
                    Markenzeichen unmittelbar links davon fuehrt an dieselbe
                    Stelle. Mit sieben Zielen zu je 44 px passt die Leiste auf
                    360 px sonst nicht, und Einstellungen und Export legen sich
                    uebereinander. */}
                <span className="hidden sm:contents">
                  <Weg
                    aktiv={currentView === 'calendar'}
                    onClick={() => onNavigate('calendar')}
                    titel="Kalender"
                  >
                    <CalendarIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Weg>
                </span>
                {isManager && (
                  <Weg
                    aktiv={currentView === 'users'}
                    onClick={() => onNavigate('users')}
                    titel="Benutzer"
                  >
                    <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Weg>
                )}
                {isManager && (
                  <Weg
                    aktiv={currentView === 'settings'}
                    onClick={() => onNavigate('settings')}
                    titel="Einstellungen"
                  >
                    <SettingsIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Weg>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-raum2 shrink-0">
            {canExport && currentView === 'calendar' && (
              <button
                type="button"
                onClick={onExport}
                className="touchziel gap-raum2 rounded-sm border border-kopf-text px-raum3 text-klein transition-colors hover:bg-kopf-text hover:text-kopf"
                title="Als PDF exportieren"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                aria-current={currentView === 'profile' ? 'page' : undefined}
                className={`touchziel gap-raum2 rounded-sm border border-kopf-text px-raum3 text-klein font-semibold transition-colors ${
                  currentView === 'profile'
                    ? 'bg-kopf-text text-kopf'
                    : 'hover:bg-kopf-text hover:text-kopf'
                }`}
                title="Profil und Passwort"
              >
                <UserIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline max-w-[10rem] truncate">
                  {currentUser.name.split(' ')[0]}
                </span>
                {/* Die Rolle steht als Wort da, nicht als Farbe: Eine gruene
                    gegen eine blaue Kachel sagt niemandem, was sie bedeutet. */}
                <span className="hidden md:inline font-normal">
                  ({currentUser.role === 'Manager' ? 'Leitung' : 'Mitarbeiter'})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="touchziel gap-raum2 rounded-none border-b-2 border-transparent px-raum2 text-klein font-normal transition-colors hover:border-kopf-text"
              title="Abmelden"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface WegProps {
  aktiv: boolean;
  onClick: () => void;
  titel: string;
  children: React.ReactNode;
}

/**
 * Ein Navigationsweg. Dass er der aktuelle ist, sagt nicht die Farbe — auf der
 * roten Leiste ist jeder Text weiss. Es sagen `aria-current` fuer die
 * Vorlesehilfe, das Schriftgewicht und ein weisser Unterstrich. Eine gefuellte
 * Kachel waere hier falsch: Ein zweiter Rotton neben dem Markenrot beisst
 * sich, egal wie man ihn waehlt. Auf schmalen Geraeten bleibt nur das Symbol sichtbar — der Name
 * steht dann im `title` und fuer Vorlesehilfen in `sr-only`.
 */
function Weg({ aktiv, onClick, titel, children }: WegProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktiv ? 'page' : undefined}
      className={`touchziel gap-raum2 rounded-none border-b-2 px-raum2 text-klein transition-colors ${
        aktiv
          ? 'border-kopf-text font-semibold'
          : 'border-transparent font-normal hover:border-kopf-text/60'
      }`}
      title={titel}
    >
      {children}
      <span className="hidden lg:inline">{titel}</span>
      <span className="sr-only lg:hidden">{titel}</span>
    </button>
  );
}
