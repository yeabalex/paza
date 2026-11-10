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
  const avatarSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 34;
  const fontSizeName = size === 'sm' ? '12px' : size === 'lg' ? '16px' : '13.5px';
  const fontSizeSub = size === 'sm' ? '10px' : size === 'lg' ? '12.5px' : '11px';

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
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: size === 'sm' ? '11px' : '14px',
            color: '#8ba888',
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
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                fontSize: fontSizeName,
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {organizerName}
            </span>

            {/* Green Verified Badge */}
            {isVerified && (
              <span
                title="Verified Organizer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#22c55e',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  flexShrink: 0,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </span>
            )}
          </div>

          {/* @username handle */}
          {organizerUsername && (
            <span style={{ fontSize: fontSizeSub, color: '#8ba888', fontWeight: 600 }}>
              @{organizerUsername.replace(/^@/, '')}
            </span>
          )}
        </div>
      </div>

      {/* Events Hosted Count Pill */}
      {eventsCount !== undefined && eventsCount > 0 && (
        <span
          style={{
            color: '#8ba888',
            fontSize: '10.5px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {eventsCount} {eventsCount === 1 ? 'Event Hosted' : 'Events Hosted'}
        </span>
      )}
    </div>
  );
};
