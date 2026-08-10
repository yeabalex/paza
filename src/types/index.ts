export interface Interest {
  id: string;
  slug: string;
  name_en: string;
  name_am?: string;
  icon_name?: string;
}

export interface UserProfile {
  id: string;
  telegram_id: number;
  full_name?: string;
  username?: string;
  phone_number?: string;
  is_registered: boolean;
  interests: Interest[];
}

export interface EventItem {
  id: string;
  title: string;
  short_description?: string;
  description?: string;
  venue_name: string;
  sub_city?: string;
  start_datetime?: string;
  end_datetime?: string;
  entrance_fee_etb: number;
  category: string;
  image_url?: string;
  source_type: 'organizer' | 'scraped';
  rsvp_count?: number;
  max_capacity?: number | string;
  organizer_name?: string;
  organizer_username?: string;
  organizer_logo?: string;
  is_organizer_verified?: boolean;
  organizer_events_count?: number;
  telebirr_phone?: string;
  telebirr_name?: string;
  cbe_account?: string;
  cbe_name?: string;
}

export interface RsvpUser {
  telegram_id: number;
  first_name: string;
  full_name?: string;
  username?: string;
  photo_url?: string;
  message?: string;
  transaction_id?: string;
  screenshot_url?: string;
  payment_method?: string;
  created_at?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}
