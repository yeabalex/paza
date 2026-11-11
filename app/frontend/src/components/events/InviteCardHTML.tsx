import { useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { EventItem, User } from '../../types';
import type { UserSearchResult } from '../../api/users';

export type VibeType = 'casual' | 'date' | 'hangout';

export interface InviteCardHTMLProps {
  event: EventItem;
  inviter: User;
  invitee: UserSearchResult | null;
  vibe: VibeType;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const VIBE_THEMES = {
  casual: {
    bg: '#0B0B0B',
    accent: '#8BA888',
    accentDark: '#5C7A59',
    shapeColor: '#8BA888',
    emoji: '✨',
    label: 'YOU\'RE INVITED',
  },
  date: {
    bg: '#0B0B0B',
    accent: '#FF6B8A',
    accentDark: '#C14B66',
    shapeColor: '#FF6B8A',
    emoji: '💖',
    label: 'DATE NIGHT',
  },
  hangout: {
    bg: '#0B0B0B',
    accent: '#F4A261',
    accentDark: '#C47F3E',
    shapeColor: '#F4A261',
    emoji: '🍻',
    label: 'LET\'S HANG',
  },
} as const;

export function InviteCardHTML({
  event,
  inviter,
  invitee,
  vibe,
  onCanvasReady,
}: InviteCardHTMLProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onCanvasReadyRef = useRef(onCanvasReady);
  const theme = VIBE_THEMES[vibe];

  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  const inviterName = inviter.first_name || inviter.username || 'Friend';
  const inviteeName = invitee
    ? invitee.full_name || invitee.username || 'You'
    : '';

  const startDate = event.start_datetime ? new Date(event.start_datetime) : null;
  const isValidStart = startDate !== null && !Number.isNaN(startDate.getTime());
  const dateStr = isValidStart && startDate
    ? startDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).toUpperCase()
    : 'DATE TBA';
  const timeStr = isValidStart && startDate
    ? startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).toUpperCase()
    : '';

  const venue = event.venue_name || 'Addis Ababa';

  useEffect(() => {
    if (!cardRef.current || !onCanvasReadyRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || !cardRef.current) return;
      html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      }).then((canvas) => {
        if (!cancelled) {
          onCanvasReadyRef.current?.(canvas);
        }
      });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [event, inviter, invitee, vibe]);

  return (
    <div
      ref={cardRef}
      className="icard"
      style={{ backgroundColor: theme.bg }}
    >
      {/* ── Bold geometric accent shape ── */}
      <div
        className="icard-shape"
        style={{ backgroundColor: theme.accent }}
      />
      <div
        className="icard-shape-2"
        style={{ borderColor: theme.accent }}
      />

      {/* ── Top-left: small label ── */}
      <div className="icard-top">
        <span className="icard-tag" style={{ color: theme.accent }}>
          {theme.label}
        </span>
      </div>

      {/* ── Hero: event title, MASSIVE ── */}
      <div className="icard-hero">
        <h1 className="icard-title">{event.title}</h1>
      </div>

      {/* ── Middle: people ── */}
      <div className="icard-people">
        <div className="icard-person">
          <div
            className="icard-initial"
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            {inviterName.charAt(0).toUpperCase()}
          </div>
          <span className="icard-name">{inviterName}</span>
        </div>

        {invitee && (
          <>
            <span className="icard-amp" style={{ color: theme.accent }}>&</span>
            <div className="icard-person">
              <div
                className="icard-initial"
                style={{ backgroundColor: theme.accent, color: theme.bg }}
              >
                {inviteeName.charAt(0).toUpperCase()}
              </div>
              <span className="icard-name">{inviteeName}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom: metadata strip ── */}
      <div className="icard-meta">
        <div className="icard-meta-item">
          <span className="icard-meta-label">WHEN</span>
          <span className="icard-meta-value" style={{ color: theme.accent }}>
            {dateStr}{timeStr ? ` · ${timeStr}` : ''}
          </span>
        </div>
        <div className="icard-meta-divider" style={{ backgroundColor: theme.accent }} />
        <div className="icard-meta-item">
          <span className="icard-meta-label">WHERE</span>
          <span className="icard-meta-value" style={{ color: theme.accent }}>
            {venue}
          </span>
        </div>
      </div>

      {/* ── Bottom branding ── */}
      <div className="icard-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <img
          src="/logo.png"
          alt="PAZA"
          style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'transparent' }}
        />
        <span className="icard-brand-text">PAZA</span>
      </div>
    </div>
  );
}
