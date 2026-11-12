import { SlidersHorizontal } from 'lucide-react';
import { AuthControls } from '../auth/AuthControls';

interface TopNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onBrandClick: () => void;
  showInterestsBtn?: boolean;
  onOpenInterests?: () => void;
}

const navTabs = [
  { id: 'home', label: 'Explore' },
  { id: 'tickets', label: 'RSVPs' },
  { id: 'saved', label: 'Saved' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onBrandClick,
  showInterestsBtn = false,
  onOpenInterests,
}: TopNavProps) {
  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-left">
          <button
            type="button"
            className="brand-trigger"
            onClick={onBrandClick}
            title="Back to PAZA Explore"
          >
            <img src="/logo.png" alt="PAZA" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-wordmark">PAZA</span>
              <span className="brand-city-tag">ADDIS ABABA</span>
            </div>
          </button>

          <nav className="top-nav-links" aria-label="Primary">
            {navTabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`top-nav-link ${activeTab === id ? 'active' : ''}`}
                onClick={() => onSelectTab(id)}
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="top-nav-actions">
          {showInterestsBtn && onOpenInterests && (
            <button
              type="button"
              className="top-nav-utility-btn"
              onClick={onOpenInterests}
              title="Customize your event interests"
            >
              <SlidersHorizontal size={13} />
              <span className="utility-label">Interests</span>
            </button>
          )}
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
