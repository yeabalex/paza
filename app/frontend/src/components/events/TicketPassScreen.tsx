import React, { useEffect, useState } from 'react';
import { fetchVerifyTicket, type TicketVerificationResult } from '../../api/events';
import { Check, X, ShieldCheck } from 'lucide-react';

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
          maxWidth: '420px',
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '10px',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-dialog)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="PAZA" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>
              PAZA / PASS
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: result?.valid ? 'var(--accent-bright)' : 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {loading ? 'VERIFYING...' : result?.valid ? 'VALIDATED' : 'INVALID'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
              Verifying pass...
            </p>
          </div>
        ) : result?.valid ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-bright)',
                  flexShrink: 0,
                }}
              >
                <Check size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  Entry Confirmed
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Present this pass at the door
                </p>
              </div>
            </div>

            {/* Ticket Specification Table */}
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Event
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {result.event_title}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                    Guest
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                    {result.attendee_name}
                  </span>
                  {result.username && (
                    <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      @{result.username}
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                    Venue
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block' }}>
                    {result.venue_name}
                  </span>
                </div>
              </div>

              {/* Code Box */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '12px',
                  textAlign: 'center',
                  marginTop: '2px',
                }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>
                  Verification Code
                </span>
                <span style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                  {result.ticket_code}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent-bright)' }} />
              <span>VERIFIED PAZA PASS</span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                color: '#f87171',
              }}
            >
              <X size={20} />
            </div>

            <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Invalid or Expired Pass
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              {result?.message || 'This ticket code could not be verified.'}
            </p>
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: '20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
