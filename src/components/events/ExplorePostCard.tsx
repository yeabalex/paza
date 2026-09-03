import { MapPin, Bookmark } from 'lucide-react';
import type { EventItem } from '../../types';

interface ExplorePostCardProps {
  event: EventItem;
  isJoined: boolean;
  onToggleJoin: (eventId: string) => void;
  onClick?: () => void;
}

export function ExplorePostCard({ event, isJoined, onToggleJoin, onClick }: ExplorePostCardProps) {
  const startDate = event.start_datetime ? new Date(event.start_datetime) : null;

  const month = startDate
    ? startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : 'TBD';

  const day = startDate
    ? startDate.getDate().toString()
    : '—';

  return (
    <article className="event-row" onClick={onClick}>
      {/* Date Column */}
      <div className="event-date-col">
        <span className="event-date-month">{month}</span>
        <span className="event-date-day">{day}</span>
      </div>

      {/* Event Info */}
      <div className="event-info-col">
        <h3 className="event-row-title">{event.title}</h3>
        <div className="event-row-venue">
          <MapPin size={12} />
          <span>{event.venue_name}{event.sub_city ? `, ${event.sub_city}` : ''}</span>
        </div>
      </div>

      {/* Fee Badge / Concluded Badge */}
      {event.is_passed ? (
        <span className="event-row-badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
          ENDED
        </span>
      ) : (
        <span className={`event-row-badge ${event.entrance_fee_etb > 0 ? 'paid' : 'free'}`}>
          {event.entrance_fee_etb > 0 ? `${event.entrance_fee_etb} ETB` : 'FREE'}
        </span>
      )}

      {/* Bookmark / Save Action Button */}
      <button
        type="button"
        className={`save-bookmark-btn ${isJoined ? 'saved' : ''}`}
        title={isJoined ? 'Unsave event' : 'Save event to DB'}
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
