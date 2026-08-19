import { Wish, MonthlyComment, Settings } from '../types';

/**
 * Holt die Begruendung aus der Serverantwort. Ohne das bliebe von einer
 * praezisen Meldung ("Name bereits vergeben", "Passwort zu kurz") nur ein
 * allgemeines "Fehler" uebrig, mit dem niemand etwas anfangen kann.
 */
async function fehlermeldung(response: Response, fallback: string): Promise<string> {
  try {
    const koerper = await response.json();
    return koerper?.error || koerper?.message || fallback;
  } catch {
    return fallback;
  }
}

export const api = {
  async getSettings(): Promise<Settings> {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },

  async getWishes(): Promise<Wish[]> {
    const response = await fetch('/api/wishes');
    if (!response.ok) {
      throw new Error('Failed to fetch wishes');
    }
    return response.json();
  },

  async addWish(wish: Omit<Wish, 'id'>): Promise<Wish> {
    const response = await fetch('/api/wishes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wish),
    });
    if (!response.ok) {
      throw new Error('Failed to add wish');
    }
    return response.json();
  },

  async deleteWish(id: string): Promise<void> {
    const response = await fetch(`/api/wishes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete wish');
    }
  },

  async getMonthlyComments(month: string): Promise<MonthlyComment[]> {
    const response = await fetch(`/api/monthly-comments?month=${month}`);
    if (!response.ok) throw new Error('Failed to fetch monthly comments');
    return response.json();
  },

  async saveMonthlyComment(comment: Omit<MonthlyComment, 'id'>): Promise<MonthlyComment> {
    const response = await fetch('/api/monthly-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    if (!response.ok) throw new Error('Failed to save monthly comment');
    return response.json();
  },

  async getUsers(): Promise<any[]> {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  async login(userId: string, password: string): Promise<{ success: boolean; user?: any; message?: string }> {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    });
    return response.json();
  },

  async createUser(user: any): Promise<void> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error(await fehlermeldung(response, 'Der Benutzer konnte nicht angelegt werden.'));
  },

  async updateUser(id: string, user: any): Promise<void> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error(await fehlermeldung(response, 'Die Aenderung konnte nicht gespeichert werden.'));
  },

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`/api/users/${id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return response.json();
  },

  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete user');
  },

  /**
   * Die Leitung setzt ein neues Passwort. Ersetzt den frueheren Weg ueber
   * `updateUser({ password })`, der die Pruefung des alten Passworts umging.
   */
  async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    return response.json();
  },
};
