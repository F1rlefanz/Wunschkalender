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

// Demo data
export const DEMO_USERS: User[] = [
  { id: 'u1', name: 'Max Mustermann', role: 'Employee' },
  { id: 'u2', name: 'Anna Schmidt', role: 'Manager' },
  { id: 'u3', name: 'Thomas Müller', role: 'Employee' },
  { id: 'u4', name: 'Laura Weber', role: 'Employee' },
  { id: 'u5', name: 'Jan Becker', role: 'Manager' },
];


