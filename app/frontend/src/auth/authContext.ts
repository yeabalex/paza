import { createContext, useContext } from 'react';

export interface AuthUserInfo {
  id: string;
  fullName: string | null;
  firstName: string | null;
  username: string | null;
  email: string | null;
  imageUrl: string | null;
}

export interface AppAuthState {
  isClerkEnabled: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUserInfo | null;
  getToken: () => Promise<string | null>;
  openSignIn: () => void;
}

export const DEFAULT_AUTH_STATE: AppAuthState = {
  isClerkEnabled: false,
  isLoaded: true,
  isSignedIn: false,
  user: null,
  getToken: async () => null,
  openSignIn: () => {},
};

export const AppAuthContext = createContext<AppAuthState>(DEFAULT_AUTH_STATE);

export function useAppAuth(): AppAuthState {
  return useContext(AppAuthContext);
}
