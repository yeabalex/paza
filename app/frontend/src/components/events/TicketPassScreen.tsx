import React, { useEffect, useState } from 'react';
import { fetchVerifyTicket, type TicketVerificationResult } from '../../api/events';
import { CheckCircle2, XCircle, ShieldCheck, Ticket, User, MapPin } from 'lucide-react';

interface TicketPassScreenProps {
  eventId: string;
  ticketCode: string;
  onClose?: () => void;
}

export const TicketPassScreen: React.FC<TicketPassScreenProps> = ({ eventId, ticketCode, onClose }) => {
  const [result, setResult] = useState<TicketVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerifyTicket(eventId, ticketCode).then((res) => {
      setResult(res);
      setLoading(false);
    });
  }, [eventId, ticketCode]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '24px',
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-dialog)',
        }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <img
            src="/logo.png"
            alt="PAZA Logo"
            style={{
              width: '84px',
              height: '84px',
              objectFit: 'contain',
              background: 'transparent',
              filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4))',
            }}
          />
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Verifying Ticket Pass...</p>
          </div>
        ) : result?.valid ? (
          <>
            {/* Header Icon */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '2px solid #22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#22c55e',
                boxShadow: '0 0 24px rgba(34, 197, 94, 0.3)',
              }}
            >
              <CheckCircle2 size={40} />
            </div>

            <span
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '1px',
                padding: '6px 14px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                display: 'inline-block',
                marginBottom: '12px',
              }}
            >
              OFFICIAL ENTRY PASS
            </span>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              ATTENDANCE CONFIRMED
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px' }}>
              Present this pass at the door for entry verification
            </p>

            {/* Ticket Card Details */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '18px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginBottom: '24px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                  Event
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Ticket size={16} style={{ color: 'var(--accent)' }} />
                  {result.event_title}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                    Attendee
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={14} style={{ color: '#60a5fa' }} />
                    {result.attendee_name}
                  </span>
                  {result.username && (
                    <span style={{ fontSize: '12px', color: '#60a5fa', display: 'block', marginTop: '2px' }}>
                      @{result.username}
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                    Venue
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={14} style={{ color: '#f59e0b' }} />
                    {result.venue_name}
                  </span>
                </div>
              </div>

              {/* Code Box */}
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px dashed rgba(34, 197, 94, 0.4)',
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Door Verification Code
                </span>
                <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '3px', color: '#ffffff' }}>
                  {result.ticket_code}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#4ade80' }}>
              <ShieldCheck size={16} />
              <span>Verified System Authentication Pass</span>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '2px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#ef4444',
              }}
            >
              <XCircle size={40} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
              INVALID OR EXPIRED TICKET
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px' }}>
              {result?.message || 'This ticket code could not be verified in our system.'}
            </p>
          </>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: '24px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Window
          </button>
        )}
      </div>
    </div>
  );
};
