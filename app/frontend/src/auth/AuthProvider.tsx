import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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

  const userId = user?.id ?? null;
  const userFullName = user?.fullName ?? null;
  const userFirstName = user?.firstName ?? null;
  const userUsername = user?.username ?? null;
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const userImageUrl = user?.imageUrl ?? null;

  const mappedUser: AuthUserInfo | null = useMemo(
    () =>
      userId
        ? {
            id: userId,
            fullName: userFullName,
            firstName: userFirstName,
            username: userUsername,
            email: userEmail,
            imageUrl: userImageUrl,
          }
        : null,
    [userId, userFullName, userFirstName, userUsername, userEmail, userImageUrl]
  );

  const openSignIn = useCallback(() => clerk.openSignIn(), [clerk]);

  const value: AppAuthState = useMemo(
    () => ({
      isClerkEnabled: true,
      isLoaded: authLoaded && userLoaded && providerReady,
      isSignedIn: Boolean(isSignedIn),
      user: mappedUser,
      getToken,
      openSignIn,
    }),
    [authLoaded, userLoaded, providerReady, isSignedIn, mappedUser, getToken, openSignIn]
  );

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
