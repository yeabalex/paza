import { Show, SignInButton, UserButton } from '@clerk/react';
import { LogIn } from 'lucide-react';
import { useAppAuth } from '../../auth/authContext';

export function AuthControls() {
  const { isClerkEnabled } = useAppAuth();

  if (!isClerkEnabled) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogIn size={14} />
            Sign In
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: { width: '30px', height: '30px' },
            },
          }}
        />
      </Show>
    </div>
  );
}
