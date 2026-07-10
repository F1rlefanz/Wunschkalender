export type ShiftType = 'Früh' | 'Spät' | 'Nacht' | 'Frei';

export interface Wish {
  id: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  comment: string;
  shiftType: ShiftType;
}

export interface MonthlyComment {
  id: string;
  employeeName: string;
  month: string; // YYYY-MM
  text: string;
}

export const EMPLOYEE_NAMES = [
  'Max Mustermann',
  'Anna Schmidt',
  'Thomas Müller',
  'Laura Weber',
  'Jan Becker'
];
