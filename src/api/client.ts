import { Wish, MonthlyComment } from '../types';

export const api = {
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

  async verifyPassword(password: string): Promise<boolean> {
    const response = await fetch('/api/verify-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    return data.success;
  }
};
