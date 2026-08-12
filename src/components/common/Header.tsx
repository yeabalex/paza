import { Settings } from 'lucide-react';
import type { UserProfile } from '../../types';

interface HeaderProps {
  user: UserProfile | null;
  onOpenSettings: () => void;
}

export function Header({ user, onOpenSettings }: HeaderProps) {
  return (
    <header className="header-bar">
      <div className="user-info">
        <div
          className="avatar"
          style={{
            width: '44px',
            height: '44px',
            overflow: 'hidden',
            background: user?.full_name ? undefined : 'transparent',
          }}
        >
          {user?.full_name ? (
            user.full_name.charAt(0)
          ) : (
            <img
              src="/logo.png"
              alt="PAZA"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent' }}
            />
          )}
        </div>
        <div className="user-meta">
          <h3>{user?.full_name || 'PAZA'}</h3>
          <p>Addis Ababa</p>
        </div>
      </div>
      <button
        type="button"
        className="header-action-btn"
        title="Customize Interests"
        onClick={onOpenSettings}
      >
        <Settings size={18} />
      </button>
    </header>
  );
}
