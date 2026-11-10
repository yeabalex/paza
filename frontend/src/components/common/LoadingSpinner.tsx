import { Loader2 } from 'lucide-react';

interface Props {
  text?: string;
}

export function LoadingSpinner({ text = 'Loading...' }: Props) {
  return (
    <div className="modal-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--accent-orange)' }}>
        <Loader2 size={36} className="animate-spin" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>{text}</p>
      </div>
    </div>
  );
}
