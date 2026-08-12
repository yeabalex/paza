import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Bookmark,
  Share2,
  Check,
  UserPlus,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { EventItem, RsvpUser, TelegramUser } from '../../types';
import {
  fetchEventDetail,
  fetchRsvps,
  removeGoing,
  type EventDetailItem,
} from '../../api/events';
import { GoingModal } from './GoingModal';
import { InviteCustomizerModal } from './InviteCustomizerModal';
import { OrganizerHeaderBadge } from './OrganizerHeaderBadge';
import { RsvpPaymentModal } from './RsvpPaymentModal';
import { openTelegramInAppUrl } from '../../utils/telegram';

interface EventDetailProps {
  event: EventItem;
  isJoined: boolean;
  onBack: () => void;
  onToggleJoin: (eventId: string) => void;
  telegramUser: TelegramUser | null;
}

const MAX_AVATARS = 5;

export function EventDetail({
  event,
  isJoined,
  onBack,
  onToggleJoin,
  telegramUser,
}: EventDetailProps) {
  const [copied, setCopied] = useState(false);
  const [fullDetail, setFullDetail] = useState<EventDetailItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);

  // RSVP state
  const [rsvps, setRsvps] = useState<RsvpUser[]>([]);
  const [isGoing, setIsGoing] = useState(false);
  const [showGoingModal, setShowGoingModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRsvpPaymentModal, setShowRsvpPaymentModal] = useState(false);
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);

  // Fetch full detail + RSVP list on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDetail(true);

    Promise.all([fetchEventDetail(event.id), fetchRsvps(event.id)]).then(
      ([detail, rsvpList]) => {
        if (!isMounted) return;
        if (detail) setFullDetail(detail);
        setRsvps(rsvpList);
        // Check if current user is already going
        if (telegramUser && rsvpList.some((r) => r.telegram_id === telegramUser.id)) {
          setIsGoing(true);
        }
        setIsLoadingDetail(false);
      }
    ).catch(() => {
      if (isMounted) setIsLoadingDetail(false);
    });

    return () => {
      isMounted = false;
    };
  }, [event.id, telegramUser]);

  const activeData = fullDetail || event;

  // Date & Time formatting with end_datetime support
  const startDate = activeData.start_datetime ? new Date(activeData.start_datetime) : null;
  const endDate = fullDetail?.end_datetime ? new Date(fullDetail.end_datetime) : null;

  let dateString = 'Date to be announced';
  if (startDate) {
    const startFmt = startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (endDate) {
      const isSameDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();

      if (isSameDay) {
        dateString = startFmt;
      } else {
        const endFmt = endDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        dateString = `${startFmt} – ${endFmt}`;
      }
    } else {
      dateString = startFmt;
    }
  }

  let timeString: string | null = null;
  if (startDate) {
    const startTimeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (endDate) {
      const endTimeStr = endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      timeString = `${startTimeStr} – ${endTimeStr}`;
    } else {
      timeString = startTimeStr;
    }
  }

  // Google Maps URLs: search by venue landmark name for a rich place card on Google Maps
  const gpsCoords = fullDetail?.location_gps;

  const venueQuery = `${activeData.venue_name || 'Addis Ababa'}${
    activeData.sub_city ? `, ${activeData.sub_city}` : ''
  }, Addis Ababa, Ethiopia`;

  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venueQuery
  )}`;

  const mapsEmbedUrl = gpsCoords
    ? `https://maps.google.com/maps?q=${encodeURIComponent(gpsCoords)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(
        venueQuery
      )}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const handleShare = () => {
    setShowInviteModal(true);
    setCopied(false);
  };

  const handleGoingClick = async () => {
    if (!telegramUser) return;

    if (isGoing) {
      // Remove RSVP
      setIsSubmittingRsvp(true);
      const success = await removeGoing(event.id, telegramUser.id);
      if (success) {
        setIsGoing(false);
        setRsvps((prev) => prev.filter((r) => r.telegram_id !== telegramUser.id));
      }
      setIsSubmittingRsvp(false);
    } else {
      // Open Payment & Registration Modal
      setShowRsvpPaymentModal(true);
    }
  };

  const hasImage = Boolean(activeData.image_url && activeData.image_url.trim().length > 0);

  return (
    <div className="event-detail-page">
      {/* ── Top Header Navigation Bar ── */}
      <header className="event-detail-nav">
        <button type="button" className="detail-nav-btn" onClick={onBack} title="Back">
          <ArrowLeft size={18} />
        </button>

        <div className="detail-nav-actions">
          <button type="button" className="detail-nav-btn" onClick={handleShare} title="Share">
            <Share2 size={18} />
          </button>

          <button
            type="button"
            className={`detail-nav-btn ${isJoined ? 'saved' : ''}`}
            onClick={() => onToggleJoin(activeData.id)}
            title={isJoined ? 'Unsave event' : 'Save event'}
          >
            <Bookmark
              size={18}
              fill={isJoined ? 'var(--accent)' : 'none'}
              color={isJoined ? 'var(--accent)' : 'var(--text-primary)'}
            />
          </button>
        </div>
      </header>

      {/* ── Hero Image (Only if image URL exists) ── */}
      {hasImage && (
        <div className="event-detail-hero">
          <img src={activeData.image_url} alt={activeData.title} className="detail-hero-img" />
          <div className="detail-hero-overlay" />
        </div>
      )}

      {/* ── Main Content Container ── */}
      <div className="event-detail-content">
        {/* Organizer Host Header Card */}
        {(activeData.organizer_name || activeData.source_type === 'organizer') && (
          <>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '8px',
              }}
            >
              <OrganizerHeaderBadge
                organizerName={activeData.organizer_name || 'Organizer Host'}
                organizerUsername={activeData.organizer_username}
                organizerLogo={activeData.organizer_logo}
                isVerified={activeData.is_organizer_verified}
                eventsCount={activeData.organizer_events_count}
                size="md"
              />
            </div>

            {/* Organizer Verification Indicator below the box */}
            {activeData.is_organizer_verified ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px',
                  fontSize: '11px',
                  color: '#4ade80',
                  fontWeight: 500,
                  paddingLeft: '4px',
                }}
              >
                <ShieldCheck size={14} style={{ color: '#22c55e' }} />
                <span>Verified Organizer</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px',
                  fontSize: '11px',
                  color: '#ef4444',
                  fontWeight: 500,
                  paddingLeft: '4px',
                }}
              >
                <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span>Organizer not verified, be cautious with your money</span>
              </div>
            )}
          </>
        )}

        {/* Category & Fee Badges */}
        <div className="detail-badge-row">
          <span className="detail-category-badge">{activeData.category}</span>
          <span className={`event-row-badge ${activeData.entrance_fee_etb > 0 ? 'paid' : 'free'}`}>
            {activeData.entrance_fee_etb > 0 ? `${activeData.entrance_fee_etb} ETB` : 'FREE'}
          </span>
        </div>

        {/* Title */}
        <h1 className="detail-title">{activeData.title}</h1>

        {/* Meta Grid Cards (Date, Venue) */}
        <div className="detail-meta-grid">
          {/* Date & Time */}
          <div className="meta-card">
            <div className="meta-card-icon">
              <Calendar size={18} />
            </div>
            <div className="meta-card-text">
              <h4>{dateString}</h4>
              {timeString && (
                <p>
                  <Clock size={12} /> {timeString}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="meta-card meta-card-location">
            <div className="meta-card-icon">
              <MapPin size={18} />
            </div>
            <div className="meta-card-text">
              <h4>{activeData.venue_name || 'Addis Ababa'}</h4>
              <p>{activeData.sub_city ? `${activeData.sub_city}, Addis Ababa` : 'Ethiopia'}</p>
            </div>
            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="maps-link-btn"
              title="Open in Google Maps"
            >
              <span>Maps</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* About Section */}
        <div className="detail-section">
          <h3 className="section-heading">About This Event</h3>
          <p className="detail-description">
            {fullDetail?.description || activeData?.description || 'Event happening in Addis Ababa.'}
          </p>
        </div>

        {/* ── Luma-style Avatar Stack — Who's Going ── */}
        <div
          className="going-section"
          onClick={() => setShowGoingModal(true)}
          style={{ cursor: 'pointer' }}
        >
          {isLoadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="dot-loader" />
              <span className="going-count">Loading attendees...</span>
            </div>
          ) : rsvps.length > 0 ? (
            <>
              <div className="avatar-stack">
                {rsvps.slice(0, MAX_AVATARS).map((user) => (
                  <div key={user.telegram_id} className="avatar-stack-item" style={{ position: 'relative' }}>
                    <span className="avatar-stack-initial" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(user.first_name || user.full_name || 'A').charAt(0).toUpperCase()}
                    </span>
                    {user.photo_url && (
                      <img
                        src={user.photo_url}
                        alt={user.first_name}
                        style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                ))}
                {rsvps.length > MAX_AVATARS && (
                  <div className="avatar-stack-item avatar-stack-overflow">
                    +{rsvps.length - MAX_AVATARS}
                  </div>
                )}
              </div>
              <span className="going-count">
                {rsvps.length} {rsvps.length === 1 ? 'person' : 'people'} going
              </span>
            </>
          ) : (
            <span className="going-count empty">Be the first to go!</span>
          )}
        </div>

        {/* ── Embedded Google Map ── */}
        <div className="map-embed-container">
          <iframe
            title="Venue Location Map"
            src={mapsEmbedUrl}
            className="map-embed-iframe"
            loading="lazy"
            allowFullScreen
          />
        </div>

        {/* ── Social Media Source Button (Only shown if user is Going) ── */}
        {(() => {
          if (!isGoing) return null;

          const postUrl = activeData.post_url || (
            activeData.id.startsWith('ig:') ? `https://www.instagram.com/p/${activeData.id.split(':')[1]}/` :
            activeData.id.startsWith('tg:') ? `https://t.me/s/${activeData.id.split(':')[1]}` :
            undefined
          );

          if (!postUrl) return null;

          let platformType: 'instagram' | 'telegram' | 'tiktok' | 'web' = 'web';
          const urlLower = postUrl.toLowerCase();
          const idLower = activeData.id.toLowerCase();

          if (urlLower.includes('instagram') || idLower.startsWith('ig:')) {
            platformType = 'instagram';
          } else if (urlLower.includes('t.me') || idLower.startsWith('tg:')) {
            platformType = 'telegram';
          } else if (urlLower.includes('tiktok') || idLower.startsWith('tiktok:')) {
            platformType = 'tiktok';
          }

          const handleOpenLink = (e: React.MouseEvent) => {
            e.preventDefault();
            openTelegramInAppUrl(postUrl);
          };

          return (
            <div className="social-source-container">
              <a
                href={postUrl}
                onClick={handleOpenLink}
                className={`social-source-btn ${platformType}`}
                title={`View original post on ${
                  platformType === 'instagram' ? 'Instagram' : platformType === 'telegram' ? 'Telegram' : platformType === 'tiktok' ? 'TikTok' : 'Source'
                }`}
              >
                <div className="social-source-circle">
                  {platformType === 'instagram' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  )}
                  {platformType === 'telegram' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.37.74-.56 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                  )}
                  {platformType === 'tiktok' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.29 0 .56.04.83.12V9.37a6.33 6.33 0 00-1-.08A6.26 6.26 0 003 15.55a6.26 6.26 0 0010.71 4.41h.01V12.1c1.55 1.1 3.41 1.75 5.43 1.75v-3.76a4.85 4.85 0 01-3.56-3.4z"/>
                    </svg>
                  )}
                  {platformType === 'web' && <ExternalLink size={18} />}
                </div>
                <span className="social-source-label">
                  View on {platformType === 'instagram' ? 'Instagram' : platformType === 'telegram' ? 'Telegram' : platformType === 'tiktok' ? 'TikTok' : 'Original Post'}
                </span>
                <ExternalLink size={14} className="social-source-arrow" />
              </a>
            </div>
          );
        })()}

        {copied && <div className="detail-toast">Link copied to clipboard!</div>}
      </div>

      {/* ── Fixed Bottom Action Dock ── */}
      <div className="event-detail-bottom-dock">
        <div className="dock-price-col">
          <span className="dock-price-label">Price</span>
          <span className="dock-price-value">
            {activeData.entrance_fee_etb > 0 ? `${activeData.entrance_fee_etb} ETB` : 'FREE'}
          </span>
        </div>

        <button
          type="button"
          className={`dock-action-btn ${isGoing ? 'going-active' : ''}`}
          onClick={handleGoingClick}
          disabled={isSubmittingRsvp}
        >
          {isGoing ? (
            <>
              <Check size={16} /> Going
            </>
          ) : (
            <>
              <UserPlus size={16} /> Going
            </>
          )}
        </button>
      </div>

      {/* ── RSVP Payment & Registration Modal ── */}
      {showRsvpPaymentModal && (
        <RsvpPaymentModal
          event={activeData}
          telegramUser={telegramUser}
          isLoading={isLoadingDetail && !fullDetail}
          onClose={() => setShowRsvpPaymentModal(false)}
          onSuccess={(newRsvp) => {
            setIsGoing(true);
            setRsvps((prev) => [newRsvp, ...prev.filter((r) => r.telegram_id !== newRsvp.telegram_id)]);
          }}
        />
      )}

      {/* ── Going Modal ── */}
      {showGoingModal && (
        <GoingModal rsvps={rsvps} onClose={() => setShowGoingModal(false)} />
      )}

      {/* ── Custom Invite Artwork Modal ── */}
      {showInviteModal && (
        <InviteCustomizerModal
          event={activeData}
          telegramUser={telegramUser}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
