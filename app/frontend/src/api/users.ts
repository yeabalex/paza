import { apiFetch } from './client';
import type { UserProfile, Interest } from '../types';

export async function fetchInterests(): Promise<Interest[]> {
  const data = await apiFetch<Interest[]>('/users/interests');
  return data || [];
}

export async function fetchUserProfile(
  userId: number | string,
  username?: string,
  fullName?: string
): Promise<UserProfile | null> {
  let url = `/users/me?user_id=${encodeURIComponent(String(userId))}`;
  if (username) {
    url += `&username=${encodeURIComponent(username)}`;
  }
  if (fullName) {
    url += `&full_name=${encodeURIComponent(fullName)}`;
  }
  return await apiFetch<UserProfile>(url, {}, 1);
}

export async function updateUserInterests(userId: number | string, interestSlugs: string[]): Promise<boolean> {
  const numericId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
  const res = await apiFetch<{ message: string }>('/users/interests', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: !isNaN(numericId) ? numericId : undefined,
      user_id: String(userId),
      interest_slugs: interestSlugs,
    }),
  });
  return res !== null;
}

export interface UserSearchResult {
  id?: string;
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
