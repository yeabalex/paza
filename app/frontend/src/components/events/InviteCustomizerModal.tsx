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

  const handleSearchChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    if (!nextQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    let active = true;
    const timer = setTimeout(() => {
      searchUsers(trimmed).then((results) => {
        if (active) {
          setSearchResults(results);
          setIsSearching(false);
        }
      });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const activeInviter: User = activeUser || {
    id: 999888777,
    first_name: 'You',
    username: 'you',
  };

  const handleSelectUser = (pickedUser: UserSearchResult) => {
    setSelectedInvitee(pickedUser);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleClearInvitee = () => {
    setSelectedInvitee(null);
    setVibe('casual');
  };

  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?event_id=${encodeURIComponent(event.id)}${
          selectedInvitee ? `&invited_by=${activeInviter.id}` : ''
        }`
      : '';

  const handleDownloadImage = () => {
    if (!canvasElement) return;
    const link = document.createElement('a');
    link.download = `invite_${event.title.replace(/\s+/g, '_')}.png`;
    if ('toDataURL' in canvasElement) {
      link.href = canvasElement.toDataURL('image/png');
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
        // User cancelled or share unavailable
      }
    }
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
          <div>
            <h3>Create Invite Artwork</h3>
            <p className="invite-modal-sub">Customize and download or share an event pass card</p>
          </div>
          <button type="button" className="invite-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body (stacks on mobile, 2-col on desktop) */}
        <div className="invite-modal-body">
          {/* Left: Live Canvas Preview */}
          <div className="invite-preview-pane">
            <div className="invite-canvas-wrapper">
              <InviteCardHTML
                event={event}
                inviter={activeInviter}
                invitee={selectedInvitee}
                vibe={vibe}
                onCanvasReady={(canvas) => setCanvasElement(canvas)}
              />
            </div>
          </div>

          {/* Right: Controls */}
          <div className="invite-controls-pane">
            <div className="invite-control-group">
              <label className="invite-control-label">Invite Someone Specific (Optional)</label>
              {selectedInvitee ? (
                <div className="selected-invitee-chip">
                  <div className="selected-invitee-avatar">
                    {(selectedInvitee.full_name || selectedInvitee.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="selected-invitee-info">
                    <span className="selected-invitee-name">
                      {selectedInvitee.full_name || selectedInvitee.username}
                    </span>
                    {selectedInvitee.username && (
                      <span className="selected-invitee-handle">@{selectedInvitee.username}</span>
                    )}
                  </div>
                  <button type="button" className="remove-invitee-btn" onClick={handleClearInvitee}>
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
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="invite-search-input"
                  />
                  {searchResults.length > 0 && (
                    <div className="invite-search-results">
                      {searchResults.map((found) => (
                        <div
                          key={found.telegram_id}
                          className="invite-search-result-item"
                          onClick={() => handleSelectUser(found)}
                        >
                          <div className="result-avatar">
                            {(found.full_name || found.username || 'U')[0].toUpperCase()}
                          </div>
                          <div className="result-info">
                            <span className="result-name">{found.full_name || found.username}</span>
                            {found.username && <span className="result-handle">@{found.username}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isSearching && <div className="searching-hint">Searching users...</div>}
            </div>

            {selectedInvitee && (
              <div className="invite-control-group">
                <label className="invite-control-label">Card Theme & Vibe</label>
                <div className="vibe-selector-row">
                  <button
                    type="button"
                    className={`vibe-chip ${vibe === 'date' ? 'active date' : ''}`}
                    onClick={() => setVibe('date')}
                  >
                    <Heart size={14} /> Date
                  </button>
                  <button
                    type="button"
                    className={`vibe-chip ${vibe === 'hangout' ? 'active hangout' : ''}`}
                    onClick={() => setVibe('hangout')}
                  >
                    <Beer size={14} /> Hangout
                  </button>
                  <button
                    type="button"
                    className={`vibe-chip ${vibe === 'casual' ? 'active casual' : ''}`}
                    onClick={() => setVibe('casual')}
                  >
                    <Sparkles size={14} /> Casual
                  </button>
                </div>
              </div>
            )}

            {copiedLink && <div className="invite-toast">Invite link copied to clipboard!</div>}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="invite-modal-footer">
          <button
            type="button"
            className="invite-action-btn primary"
            onClick={handleShare}
          >
            <Share2 size={16} />
            <span>Share Event Invite</span>
          </button>

          <div className="invite-footer-secondary">
            <button type="button" className="invite-action-btn secondary" onClick={handleDownloadImage}>
              <Download size={16} />
              <span>Save Image</span>
            </button>

            <button type="button" className="invite-action-btn secondary" onClick={handleCopyLinkOnly}>
              <LinkIcon size={16} />
              <span>Copy Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
