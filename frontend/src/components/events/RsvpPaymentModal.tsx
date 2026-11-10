import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Upload, CreditCard, User, FileText, ExternalLink } from 'lucide-react';
import type { EventItem, RsvpUser, TelegramUser } from '../../types';
import type { EventDetailItem } from '../../api/events';
import { markGoing } from '../../api/events';
import { openTelegramInAppUrl } from '../../utils/telegram';

interface RsvpPaymentModalProps {
  event: EventItem | EventDetailItem;
  telegramUser: TelegramUser | null;
  isLoading?: boolean;
  onClose: () => void;
  onSuccess: (rsvp: RsvpUser) => void;
}

export const RsvpPaymentModal: React.FC<RsvpPaymentModalProps> = ({
  event,
  telegramUser,
  isLoading = false,
  onClose,
  onSuccess,
}) => {
  const isScraped = event.source_type === 'scraped' || event.id.includes(':') || event.id.startsWith('scraped_');
  const isPaid = !isScraped && (event.entrance_fee_etb || 0) > 0;
  const initialName = telegramUser
    ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim()
    : '';

  const [fullName, setFullName] = useState(initialName);
  const [paymentMethod, setPaymentMethod] = useState<'Telebirr' | 'CBE' | 'Other'>(
    event.telebirr_phone ? 'Telebirr' : event.cbe_account ? 'CBE' : 'Other'
  );

  useEffect(() => {
    if (event.telebirr_phone) {
      setPaymentMethod('Telebirr');
    } else if (event.cbe_account) {
      setPaymentMethod('CBE');
    } else {
      setPaymentMethod('Other');
    }
  }, [event.telebirr_phone, event.cbe_account]);
  const [transactionId, setTransactionId] = useState('');
  const [message, setMessage] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 10MB');
      return;
    }

    setScreenshotName(file.name);
    setIsUploading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const tgInitData = window.Telegram?.WebApp?.initData || '';
      const res = await fetch('/api/v1/events/upload-receipt', {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(tgInitData ? { 'X-Telegram-Init-Data': tgInitData } : {}),
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setScreenshotUrl(data.url);
          setIsUploading(false);
          return;
        }
      }
      setErrorMsg('Failed to upload image to server. Please try again.');
    } catch {
      setErrorMsg('Network error uploading receipt image.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramUser) {
      setErrorMsg('Telegram user profile required');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Please provide your full name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const success = await markGoing(
        event.id,
        telegramUser,
        message.trim() || undefined,
        fullName.trim(),
        transactionId.trim() || undefined,
        screenshotUrl || undefined,
        isPaid ? paymentMethod : undefined
      );

      if (success) {
        onSuccess({
          telegram_id: telegramUser.id,
          first_name: telegramUser.first_name,
          full_name: fullName.trim(),
          username: telegramUser.username,
          photo_url: telegramUser.photo_url,
          message: message.trim() || undefined,
          transaction_id: transactionId.trim() || undefined,
          screenshot_url: screenshotUrl || undefined,
          payment_method: isPaid ? paymentMethod : undefined,
          created_at: new Date().toISOString(),
        });
        if (isScraped) {
          setIsSubmittedSuccess(true);
        } else {
          onClose();
        }
      } else {
        setErrorMsg('Failed to submit RSVP. Please try again.');
      }
    } catch (err) {
      setErrorMsg('An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPaymentAccounts = Boolean(event.telebirr_phone || event.cbe_account);

  if (isSubmittedSuccess) {
    const postUrl = event.post_url || (
      event.id.startsWith('ig:') ? `https://www.instagram.com/p/${event.id.split(':')[1]}/` :
      event.id.startsWith('tg:') ? `https://t.me/s/${event.id.split(':')[1]}` :
      undefined
    );

    let platformType: 'instagram' | 'telegram' | 'tiktok' | 'web' = 'web';
    const urlLower = (postUrl || '').toLowerCase();
    const idLower = event.id.toLowerCase();

    if (urlLower.includes('instagram') || idLower.startsWith('ig:')) {
      platformType = 'instagram';
    } else if (urlLower.includes('t.me') || idLower.startsWith('tg:')) {
      platformType = 'telegram';
    } else if (urlLower.includes('tiktok') || idLower.startsWith('tiktok:')) {
      platformType = 'tiktok';
    }

    const handleOpenLink = (e: React.MouseEvent) => {
      e.preventDefault();
      if (postUrl) {
        openTelegramInAppUrl(postUrl);
      }
    };

    return (
      <div className="going-modal-backdrop" onClick={onClose}>
        <div className="going-modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="going-modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div style={{ margin: '8px 0 12px 0', fontSize: '40px' }}>🎟️</div>

          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
            RSVP Confirmed!
          </h3>

          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            You're marked as Going to <strong>{event.title}</strong>
          </p>

          {postUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Want to check direct updates from the host?
              </span>
              <a
                href={postUrl}
                onClick={handleOpenLink}
                className={`social-source-btn ${platformType}`}
                style={{ marginTop: '4px' }}
              >
                <div className="social-source-circle">
                  {platformType === 'instagram' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  )}
                  {platformType === 'telegram' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.37.74-.56 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                  )}
                  {platformType === 'tiktok' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.29 0 .56.04.83.12V9.37a6.33 6.33 0 00-1-.08A6.26 6.26 0 003 15.55a6.26 6.26 0 0010.71 4.41h.01V12.1c1.55 1.1 3.41 1.75 5.43 1.75v-3.76a4.85 4.85 0 01-3.56-3.4z"/>
                    </svg>
                  )}
                  {platformType === 'web' && <ExternalLink size={18} />}
                </div>
                <span className="social-source-label">
                  View on {platformType === 'instagram' ? 'Instagram' : platformType === 'telegram' ? 'Telegram' : platformType === 'tiktok' ? 'TikTok' : 'Original Post'}
                </span>
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--accent)',
              border: 'none',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="going-modal-backdrop" onClick={onClose}>
      <div className="going-modal-content rsvp-modal-scroll" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="going-modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
              {isPaid ? 'Event RSVP & Payment' : 'Confirm RSVP'}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {event.title}
            </span>
          </div>
          <button type="button" className="going-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          {/* Price Header Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Entrance Fee:</span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isPaid ? '#ef4444' : (event.entrance_fee_etb || 0) > 0 ? '#f59e0b' : '#22c55e',
              }}
            >
              {(event.entrance_fee_etb || 0) > 0 ? `${event.entrance_fee_etb} ETB` : 'FREE'}
            </span>
          </div>

          {isScraped && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                lineHeight: '1.4',
              }}
            >
              ℹ️ Explore event from social media. Registration & entrance fee (if paid) are managed directly with event organizers at the venue.
            </div>
          )}

          {/* Organizer Payout Account Information (if paid or accounts configured) */}
          {isPaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Organizer Payment Accounts
              </span>

              {isLoading ? (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '14px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Loading organizer payment accounts...
                </div>
              ) : (
                <>
                  {/* Telebirr Account Details */}
              {event.telebirr_phone && (
                <div
                  style={{
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={14} /> Telebirr
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(event.telebirr_phone!, 'telebirr')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedField === 'telebirr' ? '#4ade80' : '#60a5fa',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {copiedField === 'telebirr' ? <Check size={13} /> : <Copy size={13} />}
                      {copiedField === 'telebirr' ? 'Copied' : 'Copy Number'}
                    </button>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px', color: '#ffffff' }}>
                    {event.telebirr_phone}
                  </div>
                  {event.telebirr_name && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Account Name: <strong style={{ color: '#ffffff' }}>{event.telebirr_name}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* CBE Account Details */}
              {event.cbe_account && (
                <div
                  style={{
                    background: 'rgba(147, 51, 234, 0.08)',
                    border: '1px solid rgba(147, 51, 234, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={14} /> Commercial Bank of Ethiopia (CBE)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(event.cbe_account!, 'cbe')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedField === 'cbe' ? '#4ade80' : '#c084fc',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {copiedField === 'cbe' ? <Check size={13} /> : <Copy size={13} />}
                      {copiedField === 'cbe' ? 'Copied' : 'Copy Account'}
                    </button>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px', color: '#ffffff' }}>
                    {event.cbe_account}
                  </div>
                  {event.cbe_name && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Account Name: <strong style={{ color: '#ffffff' }}>{event.cbe_name}</strong>
                    </div>
                  )}
                </div>
              )}

              {!hasPaymentAccounts && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#f59e0b',
                    padding: '10px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  Contact organizer (@{event.organizer_username || event.organizer_name || 'organizer'}) for direct payment instructions.
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Form Fields */}
          {/* 1. Full Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 2. Payment Method Selector (if paid) */}
          {isPaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Payment Method Used
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['Telebirr', 'CBE', 'Other'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: paymentMethod === method ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: paymentMethod === method ? 'rgba(139, 168, 136, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: paymentMethod === method ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {method === 'CBE' ? 'CBE Bank' : method}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Transaction ID (if paid) */}
          {isPaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Transaction Reference / ID
              </label>
              <div style={{ position: 'relative' }}>
                <FileText size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. FT240810XXXX or Txn Ref"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. Receipt / Screenshot Attachment (Organizer Events Only) */}
          {!isScraped && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isPaid ? 'Attach Payment Receipt Screenshot' : 'Attach File/Photo (Optional)'}
              </label>

              {screenshotUrl ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    maxHeight: '140px',
                  }}
                >
                  <img
                    src={screenshotUrl}
                    alt="Receipt Preview"
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotUrl(null);
                      setScreenshotName(null);
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.75)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', color: '#ffffff' }}>
                    {screenshotName || 'Attached Screenshot'}
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="rsvp-receipt-upload"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '16px',
                    border: '2px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Upload size={20} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                    {isUploading ? 'Uploading to Cloudinary...' : 'Click to upload receipt screenshot'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {isUploading ? 'Please wait a moment' : 'PNG, JPG up to 10MB'}
                  </span>
                  <input
                    id="rsvp-receipt-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {/* 5. Message / Note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Note / Message (Optional)
            </label>
            <input
              type="text"
              maxLength={140}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Can't wait! / Reserved 2 seats"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ fontSize: '12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--accent)',
                border: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Confirm RSVP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
