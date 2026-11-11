import { useState } from 'react';
import { MapPin, Bookmark, Clock, ArrowUpRight } from 'lucide-react';
import type { EventItem } from '../../types';

interface ExplorePostCardProps {
  event: EventItem;
  isJoined: boolean;
  onToggleJoin: (eventId: string) => void;
  onClick?: () => void;
  viewMode?: 'grid' | 'list';
}

const CATEGORY_THEMES: Record<string, { label: string; gradient: string; tint: string }> = {
  music: {
    label: 'Music & Concerts',
    gradient: 'linear-gradient(135deg, #13251f 0%, #0d1614 60%, #1c2c22 100%)',
    tint: '#8BA888',
  },
  nightlife: {
    label: 'Nightlife',
    gradient: 'linear-gradient(135deg, #241422 0%, #110d14 60%, #2a1820 100%)',
    tint: '#e5989b',
  },
  tech: {
    label: 'Tech & Software',
    gradient: 'linear-gradient(135deg, #10202b 0%, #0b1116 60%, #162a35 100%)',
    tint: '#7dd3fc',
  },
  business: {
    label: 'Business',
    gradient: 'linear-gradient(135deg, #211c12 0%, #11100c 60%, #292113 100%)',
    tint: '#D4A76A',
  },
  art: {
    label: 'Arts & Culture',
    gradient: 'linear-gradient(135deg, #251915 0%, #120e0d 60%, #2d1f19 100%)',
    tint: '#e2a38a',
  },
  food: {
    label: 'Food & Coffee',
    gradient: 'linear-gradient(135deg, #231910 0%, #110e0b 60%, #2c1e14 100%)',
    tint: '#deb887',
  },
  cinema: {
    label: 'Cinema & Theater',
    gradient: 'linear-gradient(135deg, #1f1419 0%, #0f0d10 60%, #291821 100%)',
    tint: '#d89ca8',
  },
  sports: {
    label: 'Sports & Gaming',
    gradient: 'linear-gradient(135deg, #14221a 0%, #0c1310 60%, #1a2d21 100%)',
    tint: '#86efac',
  },
  fitness: {
    label: 'Health & Wellness',
    gradient: 'linear-gradient(135deg, #15241f 0%, #0c1311 60%, #1d3129 100%)',
    tint: '#99f6e4',
  },
  outdoor: {
    label: 'Outdoors & Travel',
    gradient: 'linear-gradient(135deg, #162216 0%, #0c120d 60%, #1f2e1d 100%)',
    tint: '#A3C4A0',
  },
  education: {
    label: 'Workshops & Learning',
    gradient: 'linear-gradient(135deg, #151b28 0%, #0d1016 60%, #1b2436 100%)',
    tint: '#93c5fd',
  },
  community: {
    label: 'Community',
    gradient: 'linear-gradient(135deg, #172018 0%, #0e120f 60%, #202c22 100%)',
    tint: '#8BA888',
  },
};

function getCategoryMeta(rawCategory?: string) {
  const slug = (rawCategory || 'general').toLowerCase().trim();
  return (
    CATEGORY_THEMES[slug] || {
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      gradient: 'linear-gradient(135deg, #161d17 0%, #0c0e0d 60%, #1c241d 100%)',
      tint: '#8BA888',
    }
  );
}

function getSourceLabel(event: EventItem): string | null {
  if (event.source_type === 'organizer') {
    return event.organizer_name || 'Verified Host';
  }
  const id = (event.id || '').toLowerCase();
  const url = (event.post_url || '').toLowerCase();
  if (id.startsWith('ig:') || id.startsWith('instagram:') || url.includes('instagram.com')) {
    return 'Instagram';
  }
  if (id.startsWith('tg:') || id.startsWith('telegram:') || url.includes('t.me')) {
    return 'Telegram';
  }
  if (id.startsWith('tiktok:') || url.includes('tiktok.com')) {
    return 'TikTok';
  }
  return null;
}

function getSnippet(event: EventItem): string | null {
  const raw = (event.short_description || event.description || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 12) return null;
  if (raw.toLowerCase() === event.title.toLowerCase()) return null;
  return raw;
}

export function ExplorePostCard({
  event,
  isJoined,
  onToggleJoin,
  onClick,
  viewMode = 'grid',
}: ExplorePostCardProps) {
  const [imgError, setImgError] = useState(false);

  const startDate = event.start_datetime ? new Date(event.start_datetime) : null;
  const isValidDate = startDate !== null && !Number.isNaN(startDate.getTime());

  const month = isValidDate
    ? startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : 'TBD';

  const day = isValidDate ? startDate.getDate().toString() : '—';

  const weekday = isValidDate
    ? startDate.toLocaleDateString('en-US', { weekday: 'short' })
    : null;

  const timeStr = isValidDate
    ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const catMeta = getCategoryMeta(event.category);
  const sourceLabel = getSourceLabel(event);
  const hasImage = Boolean(event.image_url && event.image_url.trim().length > 0 && !imgError);
  const snippet = getSnippet(event);
  const locationText = `${event.venue_name || 'Addis Ababa'}${event.sub_city ? `, ${event.sub_city}` : ''}`;

  if (viewMode === 'list') {
    return (
      <article className="event-row" onClick={onClick}>
        {/* Date Column */}
        <div className="event-date-col">
          <span className="event-date-month">{month}</span>
          <span className="event-date-day">{day}</span>
        </div>

        {/* Optional mini thumbnail on desktop */}
        {hasImage ? (
          <div className="event-row-thumb">
            <img src={event.image_url} alt={event.title} loading="lazy" onError={() => setImgError(true)} />
          </div>
        ) : (
          <div className="event-row-thumb placeholder" style={{ background: catMeta.gradient, color: catMeta.tint }}>
            <span>{catMeta.label.charAt(0)}</span>
          </div>
        )}

        {/* Event Info */}
        <div className="event-info-col">
          <div className="event-row-top-meta">
            <span className="event-row-category" style={{ color: catMeta.tint }}>
              {catMeta.label}
            </span>
            {timeStr && (
              <span className="event-row-time">
                <Clock size={11} />
                {weekday ? `${weekday} · ${timeStr}` : timeStr}
              </span>
            )}
          </div>
          <h3 className="event-row-title">{event.title}</h3>
          <div className="event-row-venue">
            <MapPin size={12} />
            <span>{locationText}</span>
          </div>
        </div>

        {/* Fee / Status Badge */}
        {event.is_passed ? (
          <span className="event-row-badge ended">ENDED</span>
        ) : (
          <span className={`event-row-badge ${event.entrance_fee_etb > 0 ? 'paid' : 'free'}`}>
            {event.entrance_fee_etb > 0 ? `${event.entrance_fee_etb} ETB` : 'FREE'}
          </span>
        )}

        {/* Bookmark Action */}
        <button
          type="button"
          className={`save-bookmark-btn ${isJoined ? 'saved' : ''}`}
          title={isJoined ? 'Remove from Saved' : 'Save event'}
          aria-label={isJoined ? 'Remove from Saved' : 'Save event'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleJoin(event.id);
          }}
        >
          <Bookmark
            size={16}
            fill={isJoined ? 'var(--accent)' : 'none'}
            color={isJoined ? 'var(--accent)' : 'var(--text-muted)'}
          />
        </button>
      </article>
    );
  }

  return (
    <article className="event-grid-card" onClick={onClick}>
      {/* Poster / Cover Header */}
      <div className="event-card-poster" style={!hasImage ? { background: catMeta.gradient } : undefined}>
        {hasImage ? (
          <>
            <img
              src={event.image_url}
              alt={event.title}
              className="event-card-poster-img"
              loading="lazy"
              onError={() => setImgError(true)}
            />
            <div className="event-card-poster-scrim" />
          </>
        ) : (
          <div className="event-card-poster-editorial">
            <div className="poster-ring poster-ring-1" style={{ borderColor: catMeta.tint }} />
            <div className="poster-ring poster-ring-2" style={{ borderColor: catMeta.tint }} />
            <span className="poster-editorial-cat" style={{ color: catMeta.tint }}>
              {catMeta.label}
            </span>
            <span className="poster-editorial-date">
              {isValidDate ? `${weekday ? `${weekday}, ` : ''}${month} ${day}` : 'Addis Ababa'}
            </span>
          </div>
        )}

        {/* Floating Date Chip */}
        <div className="card-date-chip">
          <span className="card-date-month">{month}</span>
          <span className="card-date-day">{day}</span>
        </div>

        {/* Floating Price / Status Badge */}
        {event.is_passed ? (
          <span className="card-fee-chip ended">ENDED</span>
        ) : (
          <span className={`card-fee-chip ${event.entrance_fee_etb > 0 ? 'paid' : 'free'}`}>
            {event.entrance_fee_etb > 0 ? `${event.entrance_fee_etb} ETB` : 'FREE'}
          </span>
        )}

        {/* Bottom-left source indicator */}
        {sourceLabel && (
          <span className="card-source-chip">{sourceLabel}</span>
        )}
      </div>

      {/* Card Body */}
      <div className="event-card-body">
        <div className="event-card-eyebrow">
          <span className="event-card-category" style={{ color: catMeta.tint }}>
            {catMeta.label}
          </span>
          {timeStr && (
            <span className="event-card-time">
              <Clock size={11} />
              <span>{timeStr}</span>
            </span>
          )}
        </div>

        <h3 className="event-card-title">{event.title}</h3>

        {snippet && <p className="event-card-desc">{snippet}</p>}

        <div className="event-card-footer">
          <div className="event-card-venue">
            <MapPin size={13} />
            <span>{locationText}</span>
          </div>

          <div className="event-card-actions">
            <button
              type="button"
              className={`save-bookmark-btn ${isJoined ? 'saved' : ''}`}
              title={isJoined ? 'Remove from Saved' : 'Save event'}
              aria-label={isJoined ? 'Remove from Saved' : 'Save event'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleJoin(event.id);
              }}
            >
              <Bookmark
                size={15}
                fill={isJoined ? 'var(--accent)' : 'none'}
                color={isJoined ? 'var(--accent)' : 'var(--text-secondary)'}
              />
            </button>
            <span className="card-open-cue" aria-hidden="true">
              <ArrowUpRight size={15} />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
