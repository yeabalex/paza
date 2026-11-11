import { Show, SignInButton, UserButton } from '@clerk/react';
import { LogIn } from 'lucide-react';
import { useAppAuth } from '../../auth/authContext';

export function AuthControls() {
  const { isClerkEnabled } = useAppAuth();

  if (!isClerkEnabled) {
    return null;
  }

  return (
    <div className="auth-controls">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="auth-signin-btn">
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: { width: '32px', height: '32px' },
            },
          }}
        />
      </Show>
    </div>
  );
}
