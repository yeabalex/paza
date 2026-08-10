import { Send, Smartphone, ChevronRight } from 'lucide-react';

interface RedirectScreenProps {
  reason?: 'outside_telegram' | 'unregistered_phone';
}

export function RedirectScreen({ reason = 'outside_telegram' }: RedirectScreenProps) {
  const isPhonePending = reason === 'unregistered_phone';

  return (
    <div className="modal-overlay">
      <div className="modal-content unregistered-screen">
        <div style={{ color: '#0088cc', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          {isPhonePending ? <Smartphone size={56} /> : <Send size={56} />}
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
          {isPhonePending ? 'Finish Registration' : 'Open in Telegram'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
          {isPhonePending ? (
            <>
              Please complete registration by sharing your contact phone number in <b>@paza_events_bot</b> on Telegram to access events.
            </>
          ) : (
            <>
              PAZA Events is an exclusive Telegram Mini App. Please open Telegram and start <b>@paza_events_bot</b> to explore live Addis Ababa events.
            </>
          )}
        </p>
        <a
          href="https://t.me/paza_events_bot"
          className="bot-redirect-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Launch @paza_events_bot <ChevronRight size={18} />
        </a>
      </div>
    </div>
  );
}
