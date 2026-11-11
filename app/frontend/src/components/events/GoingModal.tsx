import { X, MessageCircle } from 'lucide-react';
import type { RsvpUser } from '../../types';

interface GoingModalProps {
  rsvps: RsvpUser[];
  onClose: () => void;
}

export function GoingModal({ rsvps, onClose }: GoingModalProps) {
  return (
    <div className="going-modal-backdrop" onClick={onClose}>
      <div className="going-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="going-modal-header">
          <h3>{rsvps.length} {rsvps.length === 1 ? 'Person' : 'People'} Going</h3>
          <button type="button" className="going-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* RSVP List */}
        <div className="going-modal-list">
          {rsvps.map((user) => (
            <div key={user.telegram_id} className="rsvp-item">
              {/* Avatar */}
              <div className="rsvp-avatar" style={{ position: 'relative' }}>
                <span
                  className="rsvp-avatar-initial"
                  style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {(user.first_name || user.full_name || 'A').charAt(0).toUpperCase()}
                </span>
                {user.photo_url && (
                  <img
                    src={user.photo_url}
                    alt={user.first_name}
                    style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>

              {/* Profile Info */}
              <div className="rsvp-info">
                <span className="rsvp-name">{user.full_name || user.first_name}</span>
                {user.username && (
                  <span className="rsvp-username">@{user.username}</span>
                )}
              </div>

              {/* Message bubble */}
              {user.message && (
                <div className="rsvp-message-bubble">
                  <MessageCircle size={10} />
                  <span>{user.message}</span>
                </div>
              )}
            </div>
          ))}

          {rsvps.length === 0 && (
            <div className="going-modal-empty">
              <p>No one has marked going yet.</p>
              <p>Be the first!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
