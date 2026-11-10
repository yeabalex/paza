import { useEffect, useRef } from 'react';
import type { EventItem, TelegramUser } from '../../types';
import type { UserSearchResult } from '../../api/users';

export type VibeType = 'casual' | 'date' | 'hangout';

export interface InviteCardCanvasProps {
  event: EventItem;
  inviter: TelegramUser;
  invitee: UserSearchResult | null;
  vibe: VibeType;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function InviteCardCanvas({
  event,
  inviter,
  invitee,
  vibe,
  onCanvasReady,
}: InviteCardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1:1 Square Canvas (1080 x 1080)
    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // ── 1. The ENTIRE Canvas is Crisp White Paper ──
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Border Frame Accent
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);

    const inviterName = (inviter.first_name || inviter.username || 'FRIEND').toUpperCase();
    const inviteeName = invitee ? (invitee.full_name || invitee.username || 'USER').toUpperCase() : '';

    let accentColor = '#8BA888';
    if (vibe === 'date') accentColor = '#E63946';
    if (vibe === 'hangout') accentColor = '#D97706';

    // ── 2. Top Text (BIG & BOLD) ──
    let topText = `IT'S ${inviterName}'S EVENT!`;
    if (invitee) {
      if (vibe === 'date') {
        topText = `DATE NIGHT: ${inviterName} & ${inviteeName} 💖`;
      } else if (vibe === 'hangout') {
        topText = `HANGOUT: ${inviterName} & ${inviteeName} 🍻`;
      } else {
        topText = `JOIN ${inviterName} & ${inviteeName} ✨`;
      }
    }

    ctx.fillStyle = '#111827';
    ctx.font = '900 38px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(topText, W / 2, 145);

    // ── 3. Avatars (BIG & CLEAN — NO BACKGROUND BOX BEHIND THEM AT ALL) ──
    const avatarY = 360;

    const drawAvatarCircle = (x: number, y: number, r: number, name: string, bg: string) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 24;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Math.floor(r * 0.95)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0).toUpperCase(), x, y);
      ctx.restore();
    };

    if (!invitee) {
      // Single Huge Avatar sitting directly on white paper
      drawAvatarCircle(W / 2, avatarY, 130, inviterName, '#8BA888');
    } else {
      // Dual Avatars sitting directly on white paper
      drawAvatarCircle(W / 2 - 145, avatarY, 110, inviterName, '#8BA888');

      // Vibe Connector Emoji Badge
      let connEmoji = '✨';
      let connBg = '#10B981';
      if (vibe === 'date') {
        connEmoji = '💖';
        connBg = '#E63946';
      }
      if (vibe === 'hangout') {
        connEmoji = '🍻';
        connBg = '#D97706';
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.arc(W / 2, avatarY, 46, 0, Math.PI * 2);
      ctx.fillStyle = connBg;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.font = '50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(connEmoji, W / 2, avatarY + 2);
      ctx.restore();

      drawAvatarCircle(W / 2 + 145, avatarY, 110, inviteeName, connBg);
    }

    // ── 4. Big Red Marker Event Title (Centered) ──
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.font = '900 56px "Comic Sans MS", "Marker Felt", "Courier New", sans-serif';
    ctx.textAlign = 'center';

    const titleText = event.title.toUpperCase();
    const words = titleText.split(' ');
    let line1 = '';
    let line2 = '';

    for (let w of words) {
      if (ctx.measureText(line1 + w + ' ').width < W - 140) {
        line1 += w + ' ';
      } else {
        line2 += w + ' ';
      }
    }

    let titleY = 610;
    ctx.fillText(line1.trim(), W / 2, titleY);

    if (line2.trim()) {
      ctx.fillText(line2.trim(), W / 2, titleY + 68);
      titleY += 68;
    }

    // ── 5. Date & Time + Venue Details (Centered) ──
    const dateVenueY = titleY + 95;

    const startDate = event.start_datetime ? new Date(event.start_datetime) : null;
    const dateStr = startDate
      ? startDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).toUpperCase()
      : 'DATE TBA';

    const timeStr = startDate
      ? startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).toUpperCase()
      : '';

    ctx.fillStyle = '#111827';
    ctx.font = '800 32px "Courier New", Courier, monospace';
    ctx.fillText(`${dateStr}${timeStr ? ' AT ' + timeStr : ''}`, W / 2, dateVenueY);

    const venueStr = `${event.venue_name || 'ADDIS ABABA'}${
      event.sub_city ? `, ${event.sub_city}` : ''
    }`.toUpperCase();
    ctx.font = '800 28px "Courier New", Courier, monospace';
    ctx.fillText(venueStr, W / 2, dateVenueY + 50);

    ctx.restore();

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }
  }, [event, inviter, invitee, vibe, onCanvasReady]);

  return (
    <canvas
      ref={canvasRef}
      className="invite-card-canvas"
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-md)',
      }}
    />
  );
}
