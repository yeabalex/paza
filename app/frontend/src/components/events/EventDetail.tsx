import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Share2,
  Check,
  UserPlus,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Users,
} from 'lucide-react';
import type { EventItem, RsvpUser, User } from '../../types';
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
import { openExternalUrl } from '../../utils/navigation';
import { useAppAuth } from '../../auth/authContext';
import { getEventPosterTheme } from '../../utils/theme';

interface EventDetailProps {
  event: EventItem;
  isJoined: boolean;
  onBack: () => void;
  onToggleJoin: (eventId: string) => void;
  user?: User | null;
  telegramUser?: User | null;
}

const MAX_AVATARS = 5;

export function EventDetail({
  event,
  isJoined,
  onBack,
  onToggleJoin,
  user,
  telegramUser,
}: EventDetailProps) {
  const currentUser = user || telegramUser || null;
  const { isClerkEnabled, isSignedIn, openSignIn } = useAppAuth();
  const [copied, setCopied] = useState(false);
  const [fullDetail, setFullDetail] = useState<EventDetailItem | null>(null);
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // RSVP state
  const [rsvps, setRsvps] = useState<RsvpUser[]>([]);
  const [isGoing, setIsGoing] = useState(false);
  const [showGoingModal, setShowGoingModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRsvpPaymentModal, setShowRsvpPaymentModal] = useState(false);
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);

  const isLoadingDetail = loadedEventId !== event.id;

  // Fetch full detail + RSVP list on mount / event switch
  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchEventDetail(event.id), fetchRsvps(event.id)])
      .then(([detail, rsvpList]) => {
        if (!isMounted) return;
        setFullDetail(detail || null);
        setRsvps(rsvpList);
        if (currentUser && rsvpList.some((r) => r.telegram_id === currentUser.id)) {
          setIsGoing(true);
        } else {
          setIsGoing(false);
        }
        setLoadedEventId(event.id);
      })
      .catch(() => {
        if (isMounted) setLoadedEventId(event.id);
      });

    return () => {
      isMounted = false;
    };
  }, [event.id, currentUser]);

  const activeData = fullDetail || event;

  // Date & Time formatting with end_datetime support
  const startDate = activeData.start_datetime ? new Date(activeData.start_datetime) : null;
  const isValidStart = startDate !== null && !Number.isNaN(startDate.getTime());
  const endDate = fullDetail?.end_datetime ? new Date(fullDetail.end_datetime) : null;
  const isValidEnd = endDate !== null && !Number.isNaN(endDate.getTime());

  let dateString = 'Date to be announced';
  if (isValidStart && startDate) {
    const startFmt = startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (isValidEnd && endDate) {
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
  if (isValidStart && startDate) {
    const startTimeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isValidEnd && endDate) {
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

  // Google Maps URLs
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
    if (isClerkEnabled && !isSignedIn) {
      openSignIn();
      return;
    }
    setShowInviteModal(true);
    setCopied(false);
  };

  const handleGoingClick = async () => {
    if (!currentUser) {
      if (isClerkEnabled) openSignIn();
      return;
    }

    if (isGoing) {
      setIsSubmittingRsvp(true);
      const success = await removeGoing(event.id, currentUser.id);
      if (success) {
        setIsGoing(false);
        setRsvps((prev) => prev.filter((r) => r.telegram_id !== currentUser.id));
      }
      setIsSubmittingRsvp(false);
    } else {
      setShowRsvpPaymentModal(true);
    }
  };

  const hasImage = Boolean(
    activeData.image_url && activeData.image_url.trim().length > 0 && !heroImgError
  );

  // Derive social post link
  const idParts = (activeData.id || '').split(':');
  const idPrefix = idParts[0]?.toLowerCase();
  const idRest = idParts.slice(1).join(':');
  const postUrl =
    activeData.post_url ||
    (idPrefix === 'ig' || idPrefix === 'instagram'
      ? `https://www.instagram.com/p/${idRest}/`
      : idPrefix === 'tg' || idPrefix === 'telegram'
      ? `https://t.me/s/${idRest}`
      : idPrefix === 'tiktok'
      ? `https://www.tiktok.com/@${idRest}`
      : undefined);

  let platformType: 'instagram' | 'telegram' | 'tiktok' | 'web' = 'web';
  if (postUrl) {
    const urlLower = postUrl.toLowerCase();
    const idLower = activeData.id.toLowerCase();
    if (urlLower.includes('instagram') || idLower.startsWith('ig:') || idLower.startsWith('instagram:')) {
      platformType = 'instagram';
    } else if (urlLower.includes('t.me') || idLower.startsWith('tg:') || idLower.startsWith('telegram:')) {
      platformType = 'telegram';
    } else if (urlLower.includes('tiktok') || idLower.startsWith('tiktok:')) {
      platformType = 'tiktok';
    }
  }

  return (
    <div className="event-detail-page">
      {/* ── Top Back / Utility Bar ── */}
      <div className="event-detail-nav">
        <div className="event-detail-nav-inner">
          <button type="button" className="detail-back-pill" onClick={onBack} title="Back to events">
            <ArrowLeft size={15} />
            <span>Directory</span>
          </button>

          <div className="detail-nav-actions">
            <button type="button" className="detail-nav-pill" onClick={handleShare} title="Invite & Share">
              <Share2 size={14} />
              <span className="detail-pill-text">Invite</span>
            </button>

            <button
              type="button"
              className={`detail-nav-pill ${isJoined ? 'saved' : ''}`}
              onClick={() => onToggleJoin(activeData.id)}
              title={isJoined ? 'Unsave event' : 'Save event'}
            >
              <Bookmark
                size={14}
                fill={isJoined ? 'currentColor' : 'none'}
              />
              <span className="detail-pill-text">{isJoined ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop Two-Column / Mobile Stacked Container ── */}
      <div className="detail-shell">
        <div className="detail-layout">
          {/* ── LEFT MAIN EDITORIAL COLUMN ── */}
          <div className="detail-main">
            {hasImage ? (
              <div className="event-detail-hero">
                <img
                  src={activeData.image_url}
                  alt={activeData.title}
                  className="detail-hero-img"
                  onError={() => setHeroImgError(true)}
                />
              </div>
            ) : (
              <div
                className="event-detail-hero-gradient"
                style={{ background: getEventPosterTheme(activeData.id, activeData.title).gradient }}
              >
                <div
                  className="poster-ambient-watermark"
                  style={{ color: getEventPosterTheme(activeData.id, activeData.title).watermarkColor }}
                  aria-hidden="true"
                >
                  {(activeData.category || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="poster-top-bar">
                  <span
                    className="poster-cat-badge"
                    style={{
                      color: getEventPosterTheme(activeData.id, activeData.title).accent,
                      backgroundColor: getEventPosterTheme(activeData.id, activeData.title).accentSoft,
                      borderColor: getEventPosterTheme(activeData.id, activeData.title).border,
                    }}
                  >
                    {activeData.category || 'Event'}
                  </span>
                  <span
                    className="poster-date-badge"
                    style={{
                      color: getEventPosterTheme(activeData.id, activeData.title).accent,
                      borderColor: getEventPosterTheme(activeData.id, activeData.title).border,
                    }}
                  >
                    {dateString}
                  </span>
                </div>
                <div className="poster-headline-wrap">
                  <h2 className="poster-detail-headline">{activeData.title}</h2>
                </div>
                <div className="poster-bottom-bar">
                  <span className="poster-venue-text">
                    {activeData.venue_name || 'Addis Ababa'}
                  </span>
                  {timeString && (
                    <span
                      className="poster-time-text"
                      style={{ color: getEventPosterTheme(activeData.id, activeData.title).accent }}
                    >
                      {timeString}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="detail-header-block">
              <div className="detail-badge-row">
                <span className="detail-category-badge">{activeData.category}</span>
                <span className="meta-sep">/</span>
                {activeData.is_passed ? (
                  <span className="detail-status-tag ended">Ended</span>
                ) : (
                  <span className={`detail-status-tag ${activeData.entrance_fee_etb > 0 ? 'paid' : 'free'}`}>
                    {activeData.entrance_fee_etb > 0 ? `${activeData.entrance_fee_etb.toLocaleString()} ETB` : 'Free Entry'}
                  </span>
                )}
              </div>

              <h1 className="detail-title">{activeData.title}</h1>
            </div>

            {/* Clean Architectural Key-Facts Strip (replaces double-boxed icon cards) */}
            <div className="detail-facts-sheet">
              <div className="detail-fact-row">
                <span className="detail-fact-label">Date &amp; Time</span>
                <div className="detail-fact-value">
                  <strong>{dateString}</strong>
                  {timeString && <span className="detail-fact-sub">{timeString}</span>}
                </div>
              </div>

              <div className="detail-fact-row">
                <span className="detail-fact-label">Location</span>
                <div className="detail-fact-value detail-fact-location">
                  <div>
                    <strong>{activeData.venue_name || 'Addis Ababa'}</strong>
                    <span className="detail-fact-sub">
                      {activeData.sub_city ? `${activeData.sub_city}, Addis Ababa` : 'Addis Ababa, Ethiopia'}
                    </span>
                  </div>
                  <a
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="maps-link-btn"
                    title="Open in Google Maps"
                  >
                    <span>Map</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>

            {/* About Section */}
            <section className="detail-section-block">
              <h2 className="section-heading">Overview</h2>
              <p className="detail-description">
                {fullDetail?.description || activeData?.description || 'Event happening in Addis Ababa.'}
              </p>
            </section>

            {/* Map Panel */}
            <section className="detail-section-block map-card-panel">
              <div className="map-card-header">
                <div>
                  <h2 className="section-heading">Venue Map</h2>
                  <p className="map-card-subtitle">{venueQuery}</p>
                </div>
                <a
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maps-link-btn"
                  title="Open in Google Maps"
                >
                  <span>Google Maps</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="map-embed-container">
                <iframe
                  title="Venue Location Map"
                  src={mapsEmbedUrl}
                  className="map-embed-iframe"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </section>

            {/* Social Source Link */}
            {postUrl && (
              <div className="social-source-container">
                <a
                  href={postUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalUrl(postUrl);
                  }}
                  className="social-source-btn"
                  title={`View original post on ${
                    platformType === 'instagram'
                      ? 'Instagram'
                      : platformType === 'telegram'
                      ? 'Telegram'
                      : platformType === 'tiktok'
                      ? 'TikTok'
                      : 'Source'
                  }`}
                >
                  <span className="social-source-platform">
                    {platformType === 'instagram'
                      ? 'INSTAGRAM'
                      : platformType === 'telegram'
                      ? 'TELEGRAM'
                      : platformType === 'tiktok'
                      ? 'TIKTOK'
                      : 'SOURCE'}
                  </span>
                  <span className="social-source-label">View original event listing</span>
                  <ExternalLink size={13} className="social-source-arrow" />
                </a>
              </div>
            )}
          </div>

          {/* ── RIGHT STICKY SIDEBAR ── */}
          <aside className="detail-sidebar">
            {/* Desktop RSVP & Ticket Box */}
            <div className="detail-sidebar-card detail-rsvp-card">
              <div className="detail-rsvp-price-row">
                <div>
                  <span className="dock-price-label">Admission</span>
                  <div className="detail-sidebar-price">
                    {activeData.entrance_fee_etb > 0
                      ? `${activeData.entrance_fee_etb.toLocaleString()} ETB`
                      : 'Free'}
                  </div>
                </div>
                {activeData.is_passed ? (
                  <span className="detail-live-pill ended">Past</span>
                ) : (
                  <span className="detail-live-pill">Registration Open</span>
                )}
              </div>

              <button
                type="button"
                className={`sidebar-rsvp-btn ${isGoing ? 'going-active' : ''}`}
                onClick={handleGoingClick}
                disabled={isSubmittingRsvp}
              >
                {isGoing ? (
                  <>
                    <Check size={15} />
                    <span>Going · Cancel RSVP</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={15} />
                    <span>RSVP for Event</span>
                  </>
                )}
              </button>

              <div className="sidebar-secondary-actions">
                <button type="button" className="sidebar-ghost-btn" onClick={handleShare}>
                  <Share2 size={14} />
                  <span>Invite Card</span>
                </button>
                <button
                  type="button"
                  className={`sidebar-ghost-btn ${isJoined ? 'saved' : ''}`}
                  onClick={() => onToggleJoin(activeData.id)}
                >
                  <Bookmark
                    size={14}
                    fill={isJoined ? 'currentColor' : 'none'}
                  />
                  <span>{isJoined ? 'Saved' : 'Bookmark'}</span>
                </button>
              </div>
            </div>

            {/* Organizer Card */}
            {(activeData.organizer_name || activeData.source_type === 'organizer') && (
              <div className="detail-sidebar-card">
                <h3 className="sidebar-card-title">Hosted By</h3>
                <OrganizerHeaderBadge
                  organizerName={activeData.organizer_name || 'Organizer Host'}
                  organizerUsername={activeData.organizer_username}
                  organizerLogo={activeData.organizer_logo}
                  isVerified={activeData.is_organizer_verified}
                  eventsCount={activeData.organizer_events_count}
                  size="md"
                />

                {activeData.is_organizer_verified ? (
                  <div className="organizer-status-note verified">
                    <ShieldCheck size={13} />
                    <span>Verified Host</span>
                  </div>
                ) : (
                  <div className="organizer-status-note unverified">
                    <AlertTriangle size={13} />
                    <span>Unverified host — confirm payment details before transfer</span>
                  </div>
                )}
              </div>
            )}

            {/* Attendees Card */}
            <div
              className="detail-sidebar-card detail-attendees-card"
              onClick={() => setShowGoingModal(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowGoingModal(true);
                }
              }}
            >
              <div className="attendees-card-top">
                <h3 className="sidebar-card-title">Guestlist</h3>
                <span className="attendees-view-link">
                  <Users size={12} />
                  <span>View all</span>
                </span>
              </div>

              <div className="going-section">
                {isLoadingDetail ? (
                  <span className="going-count empty">Loading guestlist...</span>
                ) : rsvps.length > 0 ? (
                  <>
                    <div className="avatar-stack">
                      {rsvps.slice(0, MAX_AVATARS).map((rsvpUser) => (
                        <div key={rsvpUser.telegram_id} className="avatar-stack-item" style={{ position: 'relative' }}>
                          <span
                            className="avatar-stack-initial"
                            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {(rsvpUser.first_name || rsvpUser.full_name || 'A').charAt(0).toUpperCase()}
                          </span>
                          {rsvpUser.photo_url && (
                            <img
                              src={rsvpUser.photo_url}
                              alt={rsvpUser.first_name}
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
                      {rsvps.length} {rsvps.length === 1 ? 'attending' : 'attending'}
                    </span>
                  </>
                ) : (
                  <span className="going-count empty">No public RSVPs yet</span>
                )}
              </div>
            </div>
          </aside>
        </div>

        {copied && <div className="detail-toast">Link copied to clipboard</div>}
      </div>

      {/* ── Mobile Sticky Bottom Action Dock ── */}
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

      {/* ── Modals ── */}
      {showRsvpPaymentModal && (
        <RsvpPaymentModal
          event={activeData}
          user={currentUser}
          isLoading={isLoadingDetail && !fullDetail}
          onClose={() => setShowRsvpPaymentModal(false)}
          onSuccess={(newRsvp) => {
            setIsGoing(true);
            setRsvps((prev) => [newRsvp, ...prev.filter((r) => r.telegram_id !== newRsvp.telegram_id)]);
          }}
        />
      )}

      {showGoingModal && <GoingModal rsvps={rsvps} onClose={() => setShowGoingModal(false)} />}

      {showInviteModal && (
        <InviteCustomizerModal event={activeData} user={currentUser} onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
