import { useState, useEffect } from 'react';
import type { EventItem, User } from '../../types';
import { InviteCardHTML } from './InviteCardHTML';
import { searchUsers, type UserSearchResult } from '../../api/users';
import {
  Download,
  Share2,
  X,
  Search,
  Sparkles,
  Heart,
  Beer,
  Link as LinkIcon,
} from 'lucide-react';

interface InviteCustomizerModalProps {
  event: EventItem;
  user?: User | null;
  telegramUser?: User | null;
  onClose: () => void;
}

export function InviteCustomizerModal({
  event,
  user,
  telegramUser,
  onClose,
}: InviteCustomizerModalProps) {
  const activeUser = user || telegramUser;
  const [selectedInvitee, setSelectedInvitee] = useState<UserSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [vibe, setVibe] = useState<'casual' | 'date' | 'hangout'>('casual');
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      searchUsers(searchQuery).then((results) => {
        setSearchResults(results);
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const activeInviter: User = activeUser || {
    id: 999888777,
    first_name: 'You',
    username: 'you',
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedInvitee(user);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClearInvitee = () => {
    setSelectedInvitee(null);
    setVibe('casual');
  };

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?event_id=${encodeURIComponent(event.id)}${
        selectedInvitee ? `&invited_by=${activeInviter.id}` : ''
      }`
    : '';

  const handleDownloadImage = () => {
    if (!canvasElement) return;
    const link = document.createElement('a');
    link.download = `invite_${event.title.replace(/\s+/g, '_')}.png`;
    // If canvas element is HTML, use canvas render or fallback
    if ('toDataURL' in canvasElement) {
      link.href = (canvasElement as HTMLCanvasElement).toDataURL('image/png');
      link.click();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: selectedInvitee
            ? `${activeInviter.first_name} invited ${selectedInvitee.full_name || selectedInvitee.username} to ${event.title}!`
            : `${activeInviter.first_name} invites you to ${event.title}!`,
          url: shareLink,
        });
        return;
      } catch {
        // User cancelled or share failed
      }
    }
    // Fallback: Copy link
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyLinkOnly = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="invite-modal-backdrop" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="invite-modal-header">
          <h3>Create Invite Artwork</h3>
          <button type="button" className="invite-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="invite-modal-body">
          {/* Live Canvas Preview */}
          <div className="invite-canvas-wrapper">
            <InviteCardHTML
              event={event}
              inviter={activeInviter}
              invitee={selectedInvitee}
              vibe={vibe}
              onCanvasReady={(canvas) => setCanvasElement(canvas)}
            />
          </div>

          {/* User Search Input */}
          <div className="invite-control-group">
            <label className="invite-control-label">Invite Someone Specific (Optional)</label>
            {selectedInvitee ? (
              <div className="selected-invitee-chip">
                <span>{selectedInvitee.full_name || selectedInvitee.username}</span>
                <button type="button" onClick={handleClearInvitee}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="invite-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search user name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="invite-search-input"
                />
              </div>
            )}

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="invite-search-results">
                {searchResults.map((user) => (
                  <div
                    key={user.telegram_id}
                    className="invite-search-item"
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="avatar-placeholder">
                      {(user.full_name || user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="user-info">
                      <span className="user-name">{user.full_name || user.username}</span>
                      {user.username && <span className="user-handle">@{user.username}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isSearching && <div className="searching-hint">Searching users...</div>}
          </div>

          {/* Vibe Selector */}
          {selectedInvitee && (
            <div className="invite-control-group">
              <label className="invite-control-label">Card Theme & Vibe</label>
              <div className="vibe-chips">
                <button
                  type="button"
                  className={`vibe-chip ${vibe === 'date' ? 'active date' : ''}`}
                  onClick={() => setVibe('date')}
                >
                  <Heart size={14} /> Date 💖
                </button>
                <button
                  type="button"
                  className={`vibe-chip ${vibe === 'hangout' ? 'active hangout' : ''}`}
                  onClick={() => setVibe('hangout')}
                >
                  <Beer size={14} /> Hangout 🍻
                </button>
                <button
                  type="button"
                  className={`vibe-chip ${vibe === 'casual' ? 'active casual' : ''}`}
                  onClick={() => setVibe('casual')}
                >
                  <Sparkles size={14} /> Casual ✨
                </button>
              </div>
            </div>
          )}

          {copiedLink && (
            <div className="invite-toast">Invite link copied to clipboard!</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="invite-modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="invite-action-btn primary"
            style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
            onClick={handleShare}
          >
            <Share2 size={16} /> Share Event Invite
          </button>

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button type="button" className="invite-action-btn secondary" style={{ flex: 1 }} onClick={handleDownloadImage}>
              <Download size={16} /> Save Image
            </button>

            <button type="button" className="invite-action-btn secondary" style={{ flex: 1 }} onClick={handleCopyLinkOnly}>
              <LinkIcon size={16} /> Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
