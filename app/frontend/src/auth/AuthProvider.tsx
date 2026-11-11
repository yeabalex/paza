import { useEffect, useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/react';
import { setAuthTokenProvider } from '../api/client';
import {
  AppAuthContext,
  DEFAULT_AUTH_STATE,
  type AppAuthState,
  type AuthUserInfo,
} from './authContext';

const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();
  const [providerReady, setProviderReady] = useState(false);

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    const frame = requestAnimationFrame(() => setProviderReady(true));
    return () => {
      cancelAnimationFrame(frame);
      setAuthTokenProvider(null);
    };
  }, [getToken]);

  const mappedUser: AuthUserInfo | null = user
    ? {
        id: user.id,
        fullName: user.fullName || null,
        firstName: user.firstName || null,
        username: user.username || null,
        email: user.primaryEmailAddress?.emailAddress || null,
        imageUrl: user.imageUrl || null,
      }
    : null;

  const value: AppAuthState = {
    isClerkEnabled: true,
    isLoaded: authLoaded && userLoaded && providerReady,
    isSignedIn: Boolean(isSignedIn),
    user: mappedUser,
    getToken,
    openSignIn: () => clerk.openSignIn(),
  };

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <AppAuthContext.Provider value={DEFAULT_AUTH_STATE}>
        {children}
      </AppAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
