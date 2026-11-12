import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { EventItem } from '../../types';
import { getEventPosterTheme } from '../../utils/theme';

interface ExplorePostCardProps {
  event: EventItem;
  isJoined: boolean;
  onToggleJoin: (eventId: string) => void;
  onClick?: () => void;
  viewMode?: 'grid' | 'list';
}

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music',
  nightlife: 'Nightlife',
  tech: 'Tech',
  business: 'Business',
  art: 'Arts & Culture',
  food: 'Food & Coffee',
  cinema: 'Cinema',
  sports: 'Sports',
  fitness: 'Wellness',
  outdoor: 'Outdoors',
  education: 'Workshop',
  community: 'Community',
  fashion: 'Fashion',
  bazaars: 'Bazaar',
  charity: 'Cause',
  kids: 'Family',
  realestate: 'Design',
  science: 'Science',
  books: 'Literature',
  faith: 'Spiritual',
  government: 'Policy',
};

function getCategoryLabel(rawCategory?: string): string {
  const slug = (rawCategory || 'general').toLowerCase().trim();
  return CATEGORY_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
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

  const day = isValidDate ? startDate.getDate().toString().padStart(2, '0') : '—';

  const weekday = isValidDate
    ? startDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
    : null;

  const timeStr = isValidDate
    ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const catLabel = getCategoryLabel(event.category);
  const hasImage = Boolean(event.image_url && event.image_url.trim().length > 0 && !imgError);
  const locationText = `${event.venue_name || 'Addis Ababa'}${event.sub_city ? `, ${event.sub_city}` : ''}`;
  const posterTheme = getEventPosterTheme(event.id, event.title);

  const dateLine = isValidDate
    ? `${weekday ? `${weekday}, ` : ''}${month} ${day}${timeStr ? ` · ${timeStr}` : ''}`
    : 'DATE TBA';

  const priceText = event.is_passed
    ? 'Ended'
    : event.entrance_fee_etb > 0
    ? `${event.entrance_fee_etb.toLocaleString()} ETB`
    : 'Free';

  if (viewMode === 'list') {
    return (
      <article className="event-row" onClick={onClick}>
        {/* Tabular Date Column */}
        <div className="event-date-col">
          <span className="event-date-month">{month} {day}</span>
          <span className="event-date-weekday">{weekday || 'TBA'}</span>
        </div>

        {/* Thumbnail */}
        {hasImage ? (
          <div className="event-row-thumb">
            <img src={event.image_url} alt={event.title} loading="lazy" onError={() => setImgError(true)} />
          </div>
        ) : (
          <div
            className="event-row-thumb placeholder"
            style={{
              background: posterTheme.gradient,
              color: posterTheme.accent,
              borderColor: posterTheme.border,
            }}
          >
            <span>{catLabel.slice(0, 2).toUpperCase()}</span>
          </div>
        )}

        {/* Event Info */}
        <div className="event-info-col">
          <h3 className="event-row-title">{event.title}</h3>
          <div className="event-row-sub">
            <span className="event-row-venue">{locationText}</span>
            {timeStr && (
              <>
                <span className="meta-sep">·</span>
                <span className="event-row-time">{timeStr}</span>
              </>
            )}
          </div>
        </div>

        {/* Category + Fee */}
        <div className="event-row-right">
          <span className="event-row-cat-tag">{catLabel}</span>
          <span
            className={`event-row-price ${
              event.is_passed ? 'ended' : event.entrance_fee_etb > 0 ? 'paid' : 'free'
            }`}
          >
            {priceText}
          </span>
        </div>

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
            size={15}
            fill={isJoined ? 'currentColor' : 'none'}
          />
        </button>
      </article>
    );
  }

  return (
    <article className="event-grid-card" onClick={onClick}>
      {/* Poster Frame */}
      <div className="event-card-poster">
        {hasImage ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="event-card-poster-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="event-card-poster-gradient"
            style={{ background: posterTheme.gradient }}
          >
            {/* Architectural Grid & Watermark */}
            <div
              className="poster-ambient-watermark"
              style={{ color: posterTheme.watermarkColor }}
              aria-hidden="true"
            >
              {catLabel.charAt(0)}
            </div>

            {/* Top Bar: Category pill + Date chip */}
            <div className="poster-top-bar">
              <span
                className="poster-cat-badge"
                style={{
                  color: posterTheme.accent,
                  backgroundColor: posterTheme.accentSoft,
                  borderColor: posterTheme.border,
                }}
              >
                {catLabel}
              </span>

              <span
                className="poster-date-badge"
                style={{
                  color: posterTheme.accent,
                  borderColor: posterTheme.border,
                }}
              >
                {isValidDate ? `${month} ${day}` : 'ADDIS'}
              </span>
            </div>

            {/* Center Hero: Bold Event Title */}
            <div className="poster-headline-wrap">
              <h4 className="poster-headline">{event.title}</h4>
            </div>

            {/* Bottom Bar: Venue and Time */}
            <div className="poster-bottom-bar">
              <span className="poster-venue-text">
                {event.venue_name || 'Addis Ababa'}
              </span>
              {timeStr && (
                <span className="poster-time-text" style={{ color: posterTheme.accent }}>
                  {timeStr}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Floating Bookmark */}
        <button
          type="button"
          className={`card-floating-save ${isJoined ? 'saved' : ''}`}
          title={isJoined ? 'Remove from Saved' : 'Save event'}
          aria-label={isJoined ? 'Remove from Saved' : 'Save event'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleJoin(event.id);
          }}
        >
          <Bookmark size={14} fill={isJoined ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Editorial Body Below Poster */}
      <div className="event-card-body">
        <div className="event-card-eyebrow">
          <span className="event-card-datetime">{dateLine}</span>
          <span className="event-card-category">{catLabel}</span>
        </div>

        <h3 className="event-card-title">{event.title}</h3>

        <div className="event-card-footer">
          <span className="event-card-venue">{locationText}</span>
          <span
            className={`event-card-price ${
              event.is_passed ? 'ended' : event.entrance_fee_etb > 0 ? 'paid' : 'free'
            }`}
          >
            {priceText}
          </span>
        </div>
      </div>
    </article>
  );
}
