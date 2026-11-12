import React from 'react';

interface OrganizerHeaderBadgeProps {
  organizerName?: string;
  organizerUsername?: string;
  organizerLogo?: string;
  isVerified?: boolean;
  eventsCount?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const OrganizerHeaderBadge: React.FC<OrganizerHeaderBadgeProps> = ({
  organizerName = 'Organizer Host',
  organizerUsername,
  organizerLogo,
  isVerified,
  eventsCount,
  size = 'md',
}) => {
  const avatarSize = size === 'sm' ? 28 : size === 'lg' ? 42 : 34;
  const fontSizeName = size === 'sm' ? '12.5px' : size === 'lg' ? '15.5px' : '13.5px';
  const fontSizeSub = size === 'sm' ? '11px' : size === 'lg' ? '12px' : '11.5px';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {/* Organizer Avatar / Logo */}
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '6px',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            fontSize: size === 'sm' ? '11px' : '13px',
            color: 'var(--text-primary)',
          }}
        >
          {organizerLogo ? (
            <img
              src={organizerLogo}
              alt={organizerName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>{organizerName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        {/* Name & Handle */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: fontSizeName,
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {organizerName}
            </span>

            {isVerified && (
              <span
                title="Verified Organizer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent)',
                  color: 'var(--accent-on)',
                  borderRadius: '50%',
                  width: '13px',
                  height: '13px',
                  flexShrink: 0,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </span>
            )}
          </div>

          {organizerUsername && (
            <span
              style={{
                fontSize: fontSizeSub,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              @{organizerUsername.replace(/^@/, '')}
            </span>
          )}
        </div>
      </div>

      {eventsCount !== undefined && eventsCount > 0 && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {eventsCount} {eventsCount === 1 ? 'event' : 'events'}
        </span>
      )}
    </div>
  );
};
