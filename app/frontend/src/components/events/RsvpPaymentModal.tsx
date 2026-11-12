import React, { useState } from 'react';
import { X, Copy, Check, Upload, CreditCard, User, FileText, ExternalLink } from 'lucide-react';
import type { EventItem, RsvpUser, User as AppUser } from '../../types';
import type { EventDetailItem } from '../../api/events';
import { getAuthHeaders } from '../../api/client';
import { markGoing } from '../../api/events';
import { openExternalUrl } from '../../utils/navigation';

interface RsvpPaymentModalProps {
  event: EventItem | EventDetailItem;
  user?: AppUser | null;
  telegramUser?: AppUser | null;
  isLoading?: boolean;
  onClose: () => void;
  onSuccess: (rsvp: RsvpUser) => void;
}

export const RsvpPaymentModal: React.FC<RsvpPaymentModalProps> = ({
  event,
  user,
  telegramUser,
  isLoading = false,
  onClose,
  onSuccess,
}) => {
  const activeUser = user || telegramUser || null;
  const isScraped = event.source_type === 'scraped' || event.id.includes(':') || event.id.startsWith('scraped_');
  const isPaid = !isScraped && (event.entrance_fee_etb || 0) > 0;
  const initialName = activeUser
    ? `${activeUser.first_name || ''} ${activeUser.last_name || ''}`.trim()
    : '';

  const [fullName, setFullName] = useState(initialName);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Telebirr' | 'CBE' | 'Other' | null>(null);
  const paymentMethod: 'Telebirr' | 'CBE' | 'Other' =
    selectedPaymentMethod ?? (event.telebirr_phone ? 'Telebirr' : event.cbe_account ? 'CBE' : 'Other');
  const setPaymentMethod = (method: 'Telebirr' | 'CBE' | 'Other') => setSelectedPaymentMethod(method);
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

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/v1/events/upload-receipt', {
        method: 'POST',
        headers: authHeaders,
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

    if (!fullName.trim()) {
      setErrorMsg('Please provide your full name');
      return;
    }

    const effectiveUser: AppUser = activeUser || {
      id: Math.floor(100000000 + Math.random() * 900000000),
      first_name: fullName.trim() || 'Guest User',
    };

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const success = await markGoing(
        event.id,
        effectiveUser,
        message.trim() || undefined,
        fullName.trim(),
        transactionId.trim() || undefined,
        screenshotUrl || undefined,
        isPaid ? paymentMethod : undefined
      );

      if (success) {
        onSuccess({
          telegram_id: effectiveUser.id,
          first_name: effectiveUser.first_name,
          full_name: fullName.trim(),
          username: effectiveUser.username,
          photo_url: effectiveUser.photo_url,
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
    } catch {
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
        openExternalUrl(postUrl);
      }
    };

    return (
      <div className="going-modal-backdrop" onClick={onClose}>
        <div className="going-modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '24px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="going-modal-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '4px auto 14px',
            }}
          >
            <Check size={20} />
          </div>

          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
            RSVP Confirmed
          </h3>

          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            You are registered for <strong style={{ color: 'var(--text-primary)' }}>{event.title}</strong>
          </p>

          {postUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Check direct updates from the host:
              </span>
              <a
                href={postUrl}
                onClick={handleOpenLink}
                className="social-source-btn"
              >
                <span className="social-source-platform">
                  {platformType.toUpperCase()}
                </span>
                <span className="social-source-label">
                  Open original post
                </span>
                <ExternalLink size={12} className="social-source-arrow" />
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '6px',
              background: 'var(--text-primary)',
              border: 'none',
              color: 'var(--bg-primary)',
              fontSize: '13px',
              fontWeight: 600,
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
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {isPaid ? 'RSVP & Payment' : 'Confirm RSVP'}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {event.title}
            </span>
          </div>
          <button type="button" className="going-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
          {/* Price Header Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Admission</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 600,
                color: (event.entrance_fee_etb || 0) > 0 ? 'var(--color-paid)' : 'var(--accent-bright)',
              }}
            >
              {(event.entrance_fee_etb || 0) > 0 ? `${event.entrance_fee_etb} ETB` : 'FREE'}
            </span>
          </div>

          {isScraped && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-primary)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                lineHeight: '1.45',
              }}
            >
              Directory listing from social media. Entrance fees (if applicable) are handled directly at the venue.
            </div>
          )}

          {/* Organizer Payout Account Information (if paid or accounts configured) */}
          {isPaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Transfer Accounts
              </span>

              {isLoading ? (
                <div
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
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
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CreditCard size={13} /> TELEBIRR
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(event.telebirr_phone!, 'telebirr')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedField === 'telebirr' ? 'var(--accent-bright)' : 'var(--text-primary)',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500,
                          }}
                        >
                          {copiedField === 'telebirr' ? <Check size={12} /> : <Copy size={12} />}
                          {copiedField === 'telebirr' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.telebirr_phone}
                      </div>
                      {event.telebirr_name && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Account: <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{event.telebirr_name}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CBE Account Details */}
                  {event.cbe_account && (
                    <div
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CreditCard size={13} /> CBE BANK
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(event.cbe_account!, 'cbe')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedField === 'cbe' ? 'var(--accent-bright)' : 'var(--text-primary)',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500,
                          }}
                        >
                          {copiedField === 'cbe' ? <Check size={12} /> : <Copy size={12} />}
                          {copiedField === 'cbe' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.cbe_account}
                      </div>
                      {event.cbe_name && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Account: <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{event.cbe_name}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {!hasPaymentAccounts && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-paid)',
                        padding: '10px 12px',
                        background: 'var(--color-paid-bg)',
                        borderRadius: '6px',
                        border: '1px solid rgba(214, 180, 133, 0.25)',
                      }}
                    >
                      Contact organizer (@{event.organizer_username || event.organizer_name || 'organizer'}) for payment details.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Form Fields */}
          {/* 1. Full Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 2. Payment Method Selector (if paid) */}
          {isPaid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Payment Method
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
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: paymentMethod === method ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                      background: paymentMethod === method ? 'var(--bg-elevated)' : 'var(--bg-primary)',
                      color: paymentMethod === method ? 'var(--text-primary)' : 'var(--text-muted)',
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
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Transaction Reference
              </label>
              <div style={{ position: 'relative' }}>
                <FileText size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. FT240810XXXX"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. Receipt / Screenshot Attachment (Organizer Events Only) */}
          {!isScraped && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {isPaid ? 'Payment Receipt Screenshot' : 'Attachment (Optional)'}
              </label>

              {screenshotUrl ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-medium)',
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
                      background: 'rgba(9, 9, 11, 0.8)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      width: '26px',
                      height: '26px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', background: 'rgba(9,9,11,0.85)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', color: 'var(--text-primary)' }}>
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
                    border: '1px dashed var(--border-medium)',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Upload size={18} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {isUploading ? 'Uploading receipt...' : 'Upload receipt screenshot'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {isUploading ? 'Please wait' : 'PNG, JPG up to 10MB'}
                  </span>
                  <input
                    id="rsvp-receipt-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
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
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Note (Optional)
            </label>
            <input
              type="text"
              maxLength={140}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional note for the host"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ fontSize: '12px', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 12px', borderRadius: '6px' }}>
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '6px',
                background: 'var(--text-primary)',
                border: 'none',
                color: 'var(--bg-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
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
