/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hinweisZeilen, monatDE, wunschZeilen } from './export';
import type { MonthlyComment, User, Wish } from './types';

/**
 * Das PDF zusammensetzen und den Ladevorgang ausloesen.
 *
 * Diese Datei ist die **einzige** Stelle, die `jspdf` anfasst, und wird in
 * `App.tsx` per `import()` erst beim Klick geladen. `jspdf` und sein
 * `html2canvas` wiegen zusammen den groesseren Teil des Erststarts, brauchen
 * aber nur die Leitung fuer den Export — Mitarbeitende haben ihn sonst im
 * Mobilfunknetz mitbezahlt. Wer hier eine Abhaengigkeit hinzufuegt, prueft,
 * dass sie nicht ueber einen statischen Import zurueck in den Hauptbundle
 * wandert.
 *
 * Welche Zeilen im PDF stehen, entscheidet `export.ts` — dort ohne jsPDF
 * pruefbar.
 */
export function erzeugePdf(
  monat: string,
  wuensche: Wish[],
  benutzer: User[],
  hinweise: MonthlyComment[],
): void {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Wunschkalender - ${monatDE(monat)}`, 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [['Datum', 'Name', 'Schicht', 'Kommentar']],
    body: wunschZeilen(wuensche, benutzer, monat),
  });

  // Die Monatshinweise stehen hinter den Wuenschen, nicht davor: Sonst
  // schoebe ein hinweisreicher Monat die Wunschtabelle auf die zweite Seite.
  const zeilen = hinweisZeilen(hinweise, benutzer, monat);
  if (zeilen.length > 0) {
    const nachTabelle = (doc as any).lastAutoTable?.finalY ?? 30;
    doc.setFontSize(12);
    doc.text('Monatshinweise', 14, nachTabelle + 12);
    autoTable(doc, {
      startY: nachTabelle + 16,
      head: [['Name', 'Hinweis']],
      body: zeilen,
      // Der Hinweis bekommt den Rest der Breite und wird umbrochen statt
      // abgeschnitten; lange Hinweise bleiben so lesbar.
      columnStyles: { 0: { cellWidth: 40 } },
    });
  }

  doc.save(`Wunschkalender_${monat}.pdf`);
}
