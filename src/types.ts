export type ShiftType = 'Früh' | 'Spät' | 'Nacht' | 'Frei';

export type Role = 'Manager' | 'Employee';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Wish {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  comment: string;
  shiftType: ShiftType;
}

export interface MonthlyComment {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  text: string;
}

export interface Settings {
  bookingDeadlineDay: number; // Day of month when booking locks for next month
}
