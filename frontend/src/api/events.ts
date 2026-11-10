import { apiFetch } from './client';
import type { EventItem } from '../types';

export interface CategoryInfo {
  slug: string;
  label: string;
  count?: number;
}

const PAGE_SIZE = 7;

/* ═══════════════════════════════════════════════════════════════════════════
   10-MINUTE CLIENT-SIDE CACHE IMPLEMENTATION
   ---------------------------------------------------------------------------
   REMINDER: Uncomment the caching logic below in production to cache fetched
   events for 10 minutes and minimize backend & network overhead.
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const eventCache = new Map<string, CacheEntry<any>>();

function getFromCache<T>(key: string): T | null {
  const entry = eventCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION_MS) {
    return entry.data as T;
  }
  return null;
}

function saveToCache<T>(key: string, data: T): void {
  eventCache.set(key, {
    timestamp: Date.now(),
    data: data,
  });
}

/** Clear all cached events (useful on pull-to-refresh or category reset) */
export function clearEventsCache(): void {
  eventCache.clear();
}


export async function fetchCategories(): Promise<CategoryInfo[]> {
  const cacheKey = 'categories';

  const cached = getFromCache<CategoryInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<CategoryInfo[]>('/events/categories');
  const result = data || [];

  saveToCache(cacheKey, result);

  return result;
}

export async function fetchExploreEvents(category?: string, skip = 0, timeframe: 'upcoming' | 'past' | 'all' = 'upcoming'): Promise<EventItem[]> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  params.set('timeframe', timeframe);
  params.set('skip', skip.toString());
  params.set('limit', PAGE_SIZE.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  const cacheKey = `explore_${category || 'all'}_${timeframe}_${skip}`;

  const cached = getFromCache<EventItem[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<EventItem[]>(`/events/explore${query}`);
  const result = data || [];

  saveToCache(cacheKey, result);

  return result;
}

export async function fetchForYouEvents(telegramId: number, category?: string): Promise<EventItem[]> {
  let query = `?telegram_id=${telegramId}`;
  if (category && category !== 'all') {
    query += `&category=${category}`;
  }
  const cacheKey = `foryou_${telegramId}_${category || 'all'}`;

  const cached = getFromCache<EventItem[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<EventItem[]>(`/events/for-you${query}`);
  const result = data || [];

  saveToCache(cacheKey, result);
  // saveToCache(cacheKey, result);

  return result;
}

export async function saveScrapedEvent(telegramId: number, event: EventItem): Promise<boolean> {
  const data = await apiFetch<{ status: string }>('/events/save-scraped', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: telegramId,
      event_id: event.id,
      event_data: event,
    }),
  });
  return data?.status === 'success';
}

export async function removeSavedScrapedEvent(telegramId: number, eventId: string): Promise<boolean> {
  const data = await apiFetch<{ status: string }>(
    `/events/save-scraped?telegram_id=${telegramId}&event_id=${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );
  return data?.status === 'success';
}

export async function fetchSavedScrapedEvents(telegramId: number): Promise<EventItem[]> {
  const data = await apiFetch<EventItem[]>(`/events/saved-scraped?telegram_id=${telegramId}`);
  return data || [];
}

export interface EventDetailItem extends EventItem {
  description?: string;
  image_url?: string;
  end_datetime?: string;
  location_gps?: string;
  rsvp_count?: number;
}

export async function fetchEventDetail(eventId: string): Promise<EventDetailItem | null> {
  const data = await apiFetch<EventDetailItem>(`/events/detail/${encodeURIComponent(eventId)}`);
  return data || null;
}


// ════════════════════════════════════════════════════════════════════════════════
// RSVP ("Going") API Functions
// ════════════════════════════════════════════════════════════════════════════════

import type { RsvpUser, TelegramUser } from '../types';

export async function markGoing(
  eventId: string,
  tgUser: TelegramUser,
  message?: string,
  fullName?: string,
  transactionId?: string,
  screenshotUrl?: string,
  paymentMethod?: string
): Promise<boolean> {
  const data = await apiFetch<{ status: string }>('/events/rsvp', {
    method: 'POST',
    body: JSON.stringify({
      event_id: eventId,
      telegram_id: tgUser.id,
      first_name: tgUser.first_name,
      full_name: fullName || `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
      username: tgUser.username || null,
      photo_url: tgUser.photo_url || null,
      message: message || null,
      transaction_id: transactionId || null,
      screenshot_url: screenshotUrl || null,
      payment_method: paymentMethod || null,
    }),
  });
  return data?.status === 'success';
}

export async function removeGoing(eventId: string, telegramId: number): Promise<boolean> {
  const data = await apiFetch<{ status: string }>(
    `/events/rsvp?event_id=${encodeURIComponent(eventId)}&telegram_id=${telegramId}`,
    { method: 'DELETE' }
  );
  return data?.status === 'success';
}

export async function fetchRsvps(eventId: string): Promise<RsvpUser[]> {
  const data = await apiFetch<RsvpUser[]>(`/events/rsvp?event_id=${encodeURIComponent(eventId)}`);
  return data || [];
}

export async function fetchUserRsvps(telegramId: number): Promise<EventItem[]> {
  try {
    const data = await apiFetch<EventItem[]>(`/events/user-rsvps?telegram_id=${telegramId}`);
    return data || [];
  } catch (error) {
    console.error('Failed to fetch user RSVPs:', error);
    return [];
  }
}

export interface TicketVerificationResult {
  valid: boolean;
  message?: string;
  status?: string;
  ticket_code?: string;
  event_id?: string;
  event_title?: string;
  venue_name?: string;
  attendee_name?: string;
  first_name?: string;
  username?: string;
  telegram_id?: number;
  photo_url?: string;
  payment_method?: string;
  transaction_id?: string;
  confirmed_at?: string;
}

export async function fetchVerifyTicket(eventId: string, ticketCode: string): Promise<TicketVerificationResult> {
  try {
    const data = await apiFetch<TicketVerificationResult>(
      `/events/verify-ticket?event_id=${encodeURIComponent(eventId)}&ticket_code=${encodeURIComponent(ticketCode)}`
    );
    return data || { valid: false, message: 'Could not connect to verification server.' };
  } catch (error: any) {
    return { valid: false, message: error.message || 'Verification failed.' };
  }
}

export async function sendEventInvite(params: {
  eventId: string;
  inviterName: string;
  inviterUsername?: string;
  inviteeTelegramId?: number;
  inviteeUsername?: string;
  vibe?: string;
  imageBlob?: Blob;
}): Promise<{ status: string; message: string; invite_url?: string; image_url?: string }> {
  const formData = new FormData();
  formData.append('event_id', params.eventId);
  formData.append('inviter_name', params.inviterName);
  if (params.inviterUsername) formData.append('inviter_username', params.inviterUsername);
  if (params.inviteeTelegramId) formData.append('invitee_telegram_id', params.inviteeTelegramId.toString());
  if (params.inviteeUsername) formData.append('invitee_username', params.inviteeUsername);
  if (params.vibe) formData.append('vibe', params.vibe);
  if (params.imageBlob) {
    formData.append('image', params.imageBlob, 'invite_artwork.png');
  }

  const userId = typeof window !== 'undefined' ? localStorage.getItem('paza_user_id') : null;
  const res = await fetch('/api/v1/events/send-invite', {
    method: 'POST',
    body: formData,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate invite.');
  }

  return await res.json();
}
