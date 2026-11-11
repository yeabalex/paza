import { SignIn } from '@clerk/react';
import { Lock, Calendar, Ticket, Sparkles, ShieldAlert } from 'lucide-react';

interface AuthGateProps {
  isClerkEnabled: boolean;
}

export function AuthGate({ isClerkEnabled }: AuthGateProps) {
  return (
    <div className="auth-gate-shell">
      <div className="auth-gate-container">
        {/* Left Editorial Brand Showcase */}
        <div className="auth-gate-pitch">
          <div className="auth-gate-brand">
            <img src="/logo.png" alt="PAZA" className="auth-gate-logo" />
            <div>
              <div className="brand-wordmark">PAZA</div>
              <div className="brand-city-tag">Addis Ababa</div>
            </div>
          </div>

          <div className="discovery-kicker" style={{ marginTop: '20px' }}>
            <Lock size={13} />
            <span>Protected Members Portal</span>
          </div>

          <h1 className="auth-gate-title">
            Discover &amp; RSVP to Addis Ababa&apos;s Best Events.
          </h1>
          <p className="auth-gate-subtitle">
            Sign in with your PAZA account to browse live concerts, tech meetups, exhibitions,
            RSVP for passes, and build custom invite cards.
          </p>

          <div className="auth-gate-features">
            <div className="auth-gate-feature">
              <div className="auth-feature-icon">
                <Calendar size={16} />
              </div>
              <div>
                <h4>Curated Live Discovery</h4>
                <p>Filter upcoming and past city events across venues and categories.</p>
              </div>
            </div>

            <div className="auth-gate-feature">
              <div className="auth-feature-icon">
                <Ticket size={16} />
              </div>
              <div>
                <h4>Verified Digital Passes</h4>
                <p>Sync RSVPs, Telebirr/CBE receipts, and door entry tickets to your profile.</p>
              </div>
            </div>

            <div className="auth-gate-feature">
              <div className="auth-feature-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <h4>Custom Invite Cards</h4>
                <p>Generate and share personalized event artwork with friends in one click.</p>
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
                  colorPrimary: '#8BA888',
                  colorPrimaryForeground: '#061006',
                  colorBackground: '#101214',
                  colorInput: '#070809',
                  colorInputForeground: '#f3f4f6',
                  colorForeground: '#f3f4f6',
                  colorMutedForeground: '#a1a7b0',
                  colorNeutral: '#f3f4f6',
                  colorBorder: 'rgba(255, 255, 255, 0.14)',
                  borderRadius: '12px',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                },
                elements: {
                  rootBox: { width: '100%' },
                  cardBox: {
                    width: '100%',
                    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  },
                },
              }}
            />
          ) : (
            <div className="auth-misconfigured-card">
              <div className="empty-state-icon">
                <ShieldAlert size={28} />
              </div>
              <h2>Authentication Not Configured</h2>
              <p>
                Access to PAZA is restricted. Add your Clerk credentials to continue:
              </p>
              <code className="auth-env-hint">
                VITE_CLERK_PUBLISHABLE_KEY=&quot;pk_test_...&quot;
                <br />
                CLERK_SECRET_KEY=&quot;sk_test_...&quot;
              </code>
              <p className="auth-env-note">
                Set these in <strong>.env.local</strong> for local dev (or GitHub Secrets /{' '}
                <strong>.env.prod</strong> for production) and restart the frontend server.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
