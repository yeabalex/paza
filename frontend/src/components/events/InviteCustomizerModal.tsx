import { useState, useEffect } from 'react';
import { X, Search, Share2, Download, Sparkles, Heart, Users, Send } from 'lucide-react';
import type { EventItem, TelegramUser } from '../../types';
import { searchUsers, type UserSearchResult } from '../../api/users';
import { sendEventInvite } from '../../api/events';
import { InviteCardHTML, type VibeType } from './InviteCardHTML';

interface InviteCustomizerModalProps {
  event: EventItem;
  telegramUser: TelegramUser | null;
  onClose: () => void;
}

export function InviteCustomizerModal({
  event,
  telegramUser,
  onClose,
}: InviteCustomizerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInvitee, setSelectedInvitee] = useState<UserSearchResult | null>(null);
  const [vibe, setVibe] = useState<VibeType>('casual');
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSendingBotInvite, setIsSendingBotInvite] = useState(false);
  const [botInviteSuccessMsg, setBotInviteSuccessMsg] = useState<string | null>(null);

  // Debounced search logic (300ms)
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

  const activeInviter: TelegramUser = telegramUser || {
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

  // Telegram Mini App Deep Link
  const shareLink = `https://t.me/AddisEventBot?startapp=evt_${encodeURIComponent(event.id)}${
    selectedInvitee ? `_by_${activeInviter.id}` : ''
  }`;

  const handleDownloadImage = () => {
    if (!canvasElement) return;
    const link = document.createElement('a');
    link.download = `invite_${event.title.replace(/\s+/g, '_')}.png`;
    link.href = canvasElement.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (!canvasElement) return;

    try {
      canvasElement.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'event_invite.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: event.title,
            text: selectedInvitee
              ? `${activeInviter.first_name} invited ${selectedInvitee.full_name || selectedInvitee.username} to ${event.title}!`
              : `${activeInviter.first_name} invites you to ${event.title}!`,
            url: shareLink,
            files: [file],
          });
        } else {
          // Fallback: Copy link
          await navigator.clipboard.writeText(shareLink);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        }
      });
    } catch (e) {
      console.error('Error sharing card', e);
    }
  };

  const handleSendBotInvite = async () => {
    if (!selectedInvitee || !canvasElement) return;

    try {
      setIsSendingBotInvite(true);
      canvasElement.toBlob(async (blob) => {
        if (!blob) {
          setIsSendingBotInvite(false);
          return;
        }

        try {
          await sendEventInvite({
            eventId: event.id,
            inviterName: activeInviter.first_name,
            inviterUsername: activeInviter.username,
            inviteeTelegramId: selectedInvitee.telegram_id,
            inviteeUsername: selectedInvitee.username,
            vibe: vibe,
            imageBlob: blob,
          });

          setBotInviteSuccessMsg(`🎉 Bot invite & artwork sent to @${selectedInvitee.username || selectedInvitee.full_name}!`);
          setTimeout(() => setBotInviteSuccessMsg(null), 4000);
        } catch (err: any) {
          alert(err.message || 'Failed to send bot invite.');
        } finally {
          setIsSendingBotInvite(false);
        }
      });
    } catch (e) {
      console.error('Error sending bot invite', e);
      setIsSendingBotInvite(false);
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
              onCanvasReady={setCanvasElement}
            />
          </div>

          {/* Invitee Search Section */}
          <div className="invite-section">
            <label className="invite-label">Invite Someone (Optional)</label>
            {selectedInvitee ? (
              <div className="selected-invitee-chip">
                <span className="selected-invitee-avatar">
                  {selectedInvitee.full_name?.charAt(0).toUpperCase() || selectedInvitee.username?.charAt(0).toUpperCase() || 'U'}
                </span>
                <div className="selected-invitee-info">
                  <span className="selected-invitee-name">
                    {selectedInvitee.full_name || `@${selectedInvitee.username}`}
                  </span>
                  {selectedInvitee.username && selectedInvitee.full_name && (
                    <span className="selected-invitee-handle">@{selectedInvitee.username}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="remove-invitee-btn"
                  onClick={handleClearInvitee}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="invite-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="invite-search-input"
                  placeholder="Search registered user by @username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
                {/* Dropdown Results */}
                {searchQuery && searchResults.length > 0 && (
                  <div className="invite-search-results">
                    {searchResults.map((user) => (
                      <div
                        key={user.telegram_id}
                        className="invite-search-result-item"
                        onClick={() => handleSelectUser(user)}
                      >
                        <span className="result-avatar">
                          {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
                        </span>
                        <div className="result-info">
                          <span className="result-name">{user.full_name || user.username}</span>
                          {user.username && <span className="result-handle">@{user.username}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="invite-search-results empty">No registered user found</div>
                )}
              </div>
            )}
          </div>

          {/* Vibe Selector (Shown when invitee is selected) */}
          {selectedInvitee && (
            <div className="invite-section">
              <label className="invite-label">Select Vibe & Intent</label>
              <div className="vibe-selector-row">
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
                  <Users size={14} /> Hangout 🍻
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

          {botInviteSuccessMsg && (
            <div className="invite-toast" style={{ background: '#22c55e', color: '#000' }}>
              {botInviteSuccessMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="invite-modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
          {selectedInvitee && (
            <button
              type="button"
              className="invite-action-btn primary"
              style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
              onClick={handleSendBotInvite}
              disabled={isSendingBotInvite}
            >
              <Send size={16} />
              {isSendingBotInvite ? 'Sending Bot Message...' : `Send Bot Invite to @${selectedInvitee.username || selectedInvitee.full_name}`}
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button type="button" className="invite-action-btn secondary" style={{ flex: 1 }} onClick={handleDownloadImage}>
              <Download size={16} /> Save Image
            </button>

            <button type="button" className="invite-action-btn secondary" style={{ flex: 1 }} onClick={handleShare}>
              <Share2 size={16} /> Share Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
