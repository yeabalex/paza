import type { ReactNode } from 'react';
import { useAppAuth } from '../../auth/authContext';
import { AuthGate } from './AuthGate';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Frontend route-guard wrapper component.
 * Blocks all child pages and hooks from mounting until Clerk auth is loaded and signed in.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isClerkEnabled, isLoaded, isSignedIn, user } = useAppAuth();

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="PAZA Events" className="loading-logo" />
        <div className="loading-wordmark">PAZA EVENTS</div>
        <div className="loading-dots">
          <div className="dot-loader" />
          <div className="dot-loader" style={{ animationDelay: '0.15s' }} />
          <div className="dot-loader" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    );
  }

  if (!isClerkEnabled || !isSignedIn || !user) {
    return <AuthGate isClerkEnabled={isClerkEnabled} />;
  }

  return <>{children}</>;
}

