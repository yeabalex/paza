import React from 'react';
import { Calendar } from 'lucide-react';
import type { EventItem } from '../../types';
import { OrganizerHeaderBadge } from './OrganizerHeaderBadge';

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

interface EventCardProps {
  event: EventItem;
  isJoined: boolean;
  onToggleJoin: (eventId: string) => void;
  onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onClick,
}) => {
  const dateStr = event.start_datetime
    ? new Date(event.start_datetime).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Upcoming';

  return (
    <article className="event-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Top Organizer Badge Header */}
      {(event.organizer_name || event.source_type === 'organizer') && (
        <div style={{ padding: '12px 14px 10px 14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <OrganizerHeaderBadge
            organizerName={event.organizer_name || 'Organizer Host'}
            organizerUsername={event.organizer_username}
            organizerLogo={event.organizer_logo}
            isVerified={event.is_organizer_verified}
            eventsCount={event.organizer_events_count}
            size="md"
          />
        </div>
      )}

      <div className="event-cover-container">
        <img
          src={event.image_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'}
          alt={event.title}
          className="event-cover-img"
        />
        <div className="date-badge">
          <Calendar size={13} /> {dateStr}
        </div>
        <div className={`price-badge-overlay ${event.entrance_fee_etb > 0 ? 'paid' : ''}`}>
          {event.entrance_fee_etb > 0 ? 'Paid' : 'Free'}
        </div>
      </div>
      <div className="event-details">
        <h3 className="event-title">{event.title}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          {truncateText(event.short_description || 'Event in Addis Ababa.', 60)}
        </p>
      </div>
    </article>
  );
};
