import { SignIn } from '@clerk/react';
import { ShieldAlert } from 'lucide-react';

interface AuthGateProps {
  isClerkEnabled: boolean;
}

export function AuthGate({ isClerkEnabled }: AuthGateProps) {
  return (
    <div className="auth-gate-shell">
      <div className="auth-gate-container">
        {/* Left Editorial Masthead */}
        <div className="auth-gate-pitch">
          <div className="auth-gate-brand">
            <img src="/logo.png" alt="PAZA" className="auth-gate-logo" />
            <div>
              <div className="brand-wordmark">PAZA</div>
              <div className="brand-city-tag">ADDIS ABABA</div>
            </div>
          </div>

          <div className="discovery-kicker" style={{ marginTop: '32px' }}>
            <span>CITY CULTURAL DIRECTORY</span>
          </div>

          <h1 className="auth-gate-title">
            What’s happening across Addis Ababa.
          </h1>
          <p className="auth-gate-subtitle">
            An index of live music, exhibitions, screenings, and Independent gatherings—with direct RSVP passes and venue directories.
          </p>

          <div className="auth-gate-specs">
            <div className="auth-spec-row">
              <span className="auth-spec-num">01</span>
              <div className="auth-spec-text">
                <strong>Live Index</strong>
                <span>Concerts, club nights, tech meetups, and gallery openings.</span>
              </div>
            </div>

            <div className="auth-spec-row">
              <span className="auth-spec-num">02</span>
              <div className="auth-spec-text">
                <strong>Direct Passes</strong>
                <span>RSVP confirmation, Telebirr &amp; CBE receipt verification, and door codes.</span>
              </div>
            </div>

            <div className="auth-spec-row">
              <span className="auth-spec-num">03</span>
              <div className="auth-spec-text">
                <strong>Shared Shortlists</strong>
                <span>Bookmark upcoming dates and generate custom event passes for friends.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Box */}
        <div className="auth-gate-card-wrap">
          {isClerkEnabled ? (
            <SignIn
              routing="hash"
              appearance={{
                variables: {
                  colorPrimary: '#f4f4f5',
                  colorPrimaryForeground: '#09090b',
                  colorBackground: '#111113',
                  colorInput: '#09090b',
                  colorInputForeground: '#f4f4f5',
                  colorForeground: '#f4f4f5',
                  colorMutedForeground: '#a1a1aa',
                  colorNeutral: '#f4f4f5',
                  colorBorder: 'rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                },
                elements: {
                  rootBox: { width: '100%' },
                  cardBox: {
                    width: '100%',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  },
                },
              }}
            />
          ) : (
            <div className="auth-misconfigured-card">
              <div className="empty-state-icon">
                <ShieldAlert size={22} />
              </div>
              <h2>Authentication Not Configured</h2>
              <p>
                Access to PAZA is restricted. Add your Clerk credentials to continue:
              </p>
              <code className="auth-env-hint">
                VITE_CLERK_PUBLISHABLE_KEY=&quot;pk_...&quot;
              </code>
              <p className="auth-env-note">
                Set this in <strong>.env.local</strong> for local dev (or GitHub Secrets /{' '}
                <strong>.env.prod</strong> for production) and restart the frontend server.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
