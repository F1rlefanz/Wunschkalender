import { describe, expect, it } from 'vitest';
import { datumDE, hinweisZeilen, monatDE, wunschZeilen } from './export';
import type { MonthlyComment, User, Wish } from './types';

const benutzer: User[] = [
  { id: 'u1', name: 'Zeller', role: 'Manager' },
  { id: 'u2', name: 'Ahrens', role: 'Employee' },
];

const wuensche: Wish[] = [
  { id: 'w1', userId: 'u2', date: '2026-08-14', comment: '', shiftType: 'Nacht' },
  { id: 'w2', userId: 'u1', date: '2026-08-03', comment: 'Fahrgemeinschaft', shiftType: 'Früh' },
  { id: 'w3', userId: 'u2', date: '2026-09-01', comment: '', shiftType: 'Frei' },
];

const hinweise: MonthlyComment[] = [
  { id: 'h1', userId: 'u1', month: '2026-08', text: 'max. 3 Nachtdienste' },
  { id: 'h2', userId: 'u2', month: '2026-08', text: 'Urlaub 12.-15.' },
  { id: 'h3', userId: 'u2', month: '2026-09', text: 'Fortbildung' },
];

describe('datumDE / monatDE', () => {
  it('dreht Datum und Monat um, ohne den Umweg ueber Date', () => {
    expect(datumDE('2026-01-05')).toBe('05.01.2026');
    expect(monatDE('2026-12')).toBe('12/2026');
  });
});

describe('wunschZeilen', () => {
  it('nimmt nur den ausgewaehlten Monat, nach Datum sortiert', () => {
    expect(wunschZeilen(wuensche, benutzer, '2026-08')).toEqual([
      ['03.08.2026', 'Zeller', 'Frühdienst', 'Fahrgemeinschaft'],
      ['14.08.2026', 'Ahrens', 'Nachtdienst', '-'],
    ]);
  });

  it('verwechselt gleiche Monate verschiedener Jahre nicht', () => {
    const vorjahr: Wish[] = [
      { id: 'w4', userId: 'u1', date: '2025-08-03', comment: '', shiftType: 'Spät' },
    ];
    expect(wunschZeilen(vorjahr, benutzer, '2026-08')).toEqual([]);
  });

  it('nennt geloeschte Personen Unbekannt, statt die Zeile zu verlieren', () => {
    const verwaist: Wish[] = [
      { id: 'w5', userId: 'weg', date: '2026-08-02', comment: '', shiftType: 'Frei' },
    ];
    expect(wunschZeilen(verwaist, benutzer, '2026-08')[0][1]).toBe('Unbekannt');
  });

  it('laesst die uebergebene Liste unangetastet', () => {
    const eingabe = wuensche.slice();
    wunschZeilen(eingabe, benutzer, '2026-08');
    expect(eingabe.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });
});

describe('hinweisZeilen', () => {
  it('nimmt alle Personen des Monats, nach Namen sortiert', () => {
    expect(hinweisZeilen(hinweise, benutzer, '2026-08')).toEqual([
      ['Ahrens', 'Urlaub 12.-15.'],
      ['Zeller', 'max. 3 Nachtdienste'],
    ]);
  });

  it('nimmt keine Hinweise anderer Monate', () => {
    expect(hinweisZeilen(hinweise, benutzer, '2026-09')).toEqual([['Ahrens', 'Fortbildung']]);
  });

  it('laesst geleerte Hinweise weg', () => {
    const leer: MonthlyComment[] = [
      { id: 'h4', userId: 'u1', month: '2026-08', text: '   ' },
    ];
    expect(hinweisZeilen(leer, benutzer, '2026-08')).toEqual([]);
  });
});
