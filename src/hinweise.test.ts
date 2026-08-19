import { describe, expect, it } from 'vitest';
import { eigenerHinweis, fremdeHinweise, uebernehmeServerstand } from './hinweise';
import type { MonthlyComment, User } from './types';

const leitung: User = { id: 'u1', name: 'Leitung', role: 'Manager' };
const pflege: User = { id: 'u2', name: 'Pflegekraft', role: 'Employee' };

const hinweise: MonthlyComment[] = [
  { id: 'h1', userId: 'u1', month: '2026-08', text: 'August, Leitung' },
  { id: 'h2', userId: 'u2', month: '2026-08', text: 'August, Pflegekraft' },
  { id: 'h3', userId: 'u2', month: '2026-09', text: 'September, Pflegekraft' },
];

describe('fremdeHinweise', () => {
  it('zeigt der Leitung nur Hinweise anderer aus dem dargestellten Monat', () => {
    expect(fremdeHinweise(hinweise, '2026-08', leitung).map((h) => h.id)).toEqual(['h2']);
  });

  it('zeigt Mitarbeitenden keine fremden Hinweise', () => {
    expect(fremdeHinweise(hinweise, '2026-08', pflege)).toEqual([]);
  });

  it('liefert nichts ohne angemeldete Person', () => {
    expect(fremdeHinweise(hinweise, '2026-08', null)).toEqual([]);
  });
});

describe('eigenerHinweis', () => {
  it('findet den eigenen Hinweis des dargestellten Monats', () => {
    expect(eigenerHinweis(hinweise, '2026-09', pflege)?.id).toBe('h3');
  });

  it('liefert nichts, wenn im dargestellten Monat noch nichts steht', () => {
    expect(eigenerHinweis(hinweise, '2026-10', pflege)).toBeUndefined();
  });

  it('verwechselt Monate desselben Jahres nicht mit denen anderer Jahre', () => {
    const ueberJahresgrenze: MonthlyComment[] = [
      { id: 'h4', userId: 'u2', month: '2025-08', text: 'Vorjahr' },
    ];
    expect(eigenerHinweis(ueberJahresgrenze, '2026-08', pflege)).toBeUndefined();
  });
});

describe('uebernehmeServerstand', () => {
  const stand = { schluessel: 'u2|2026-08', text: 'gespeichert' };

  it('uebernimmt den Servertext, wenn im Feld nichts Ungespeichertes steht', () => {
    const ergebnis = uebernehmeServerstand({
      schluessel: 'u2|2026-08',
      serverText: 'von der Leitung ergaenzt',
      feldText: 'gespeichert',
      uebernommen: stand,
    });
    expect(ergebnis.feldText).toBe('von der Leitung ergaenzt');
    expect(ergebnis.uebernommen.text).toBe('von der Leitung ergaenzt');
  });

  it('laesst getippten Text stehen, wenn nebenher ein Ereignis eintrifft', () => {
    const ergebnis = uebernehmeServerstand({
      schluessel: 'u2|2026-08',
      serverText: 'gespeichert',
      feldText: 'gerade getippt, noch nicht gespeichert',
      uebernommen: stand,
    });
    expect(ergebnis.feldText).toBe('gerade getippt, noch nicht gespeichert');
    expect(ergebnis.uebernommen).toEqual(stand);
  });

  it('laedt beim Monatswechsel neu, auch wenn im Feld etwas stand', () => {
    const ergebnis = uebernehmeServerstand({
      schluessel: 'u2|2026-09',
      serverText: 'September',
      feldText: 'August, ungespeichert',
      uebernommen: stand,
    });
    expect(ergebnis.feldText).toBe('September');
    expect(ergebnis.uebernommen).toEqual({ schluessel: 'u2|2026-09', text: 'September' });
  });

  it('merkt sich den Stand, sobald das eigene Speichern zurueckkommt', () => {
    const ergebnis = uebernehmeServerstand({
      schluessel: 'u2|2026-08',
      serverText: 'neu getippt',
      feldText: 'neu getippt',
      uebernommen: stand,
    });
    expect(ergebnis.feldText).toBe('neu getippt');
    expect(ergebnis.uebernommen).toEqual({ schluessel: 'u2|2026-08', text: 'neu getippt' });
  });
});
