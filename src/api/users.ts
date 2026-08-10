import { apiFetch } from './client';
import type { UserProfile, Interest } from '../types';

export async function fetchInterests(): Promise<Interest[]> {
  const data = await apiFetch<Interest[]>('/users/interests');
  return data || [];
}

export async function fetchUserProfile(
  telegramId: number,
  initData?: string,
  username?: string,
  fullName?: string
): Promise<UserProfile | null> {
  let url = `/users/me?telegram_id=${telegramId}`;
  if (initData) {
    url += `&init_data=${encodeURIComponent(initData)}`;
  }
  if (username) {
    url += `&username=${encodeURIComponent(username)}`;
  }
  if (fullName) {
    url += `&full_name=${encodeURIComponent(fullName)}`;
  }
  return await apiFetch<UserProfile>(url);
}

export async function updateUserInterests(telegramId: number, interestSlugs: string[]): Promise<boolean> {
  const res = await apiFetch<{ message: string }>('/users/interests', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: telegramId,
      interest_slugs: interestSlugs,
    }),
  });
  return res !== null;
}

export interface UserSearchResult {
  telegram_id: number;
  full_name?: string;
  username?: string;
  photo_url?: string;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  const data = await apiFetch<UserSearchResult[]>(`/users/search?query=${encodeURIComponent(query)}`);
  return data || [];
}

