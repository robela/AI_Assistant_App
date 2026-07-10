// ───────────────────────────────────────────────────────────────────────────
//  Auth context — ported from the web app's utils/auth.tsx.
//  Uses expo-secure-store instead of localStorage (secure on-device storage).
// ───────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin } from './api';

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  username: string | null;
}

interface AuthContextType extends AuthState {
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  subscriptionKey: string;
  setSubscriptionKey: (key: string) => void;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'hcdai_auth';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  defaultBackendUrl,
}: {
  children: React.ReactNode;
  defaultBackendUrl: string;
}) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    role: null,
    username: null,
  });
  const [backendUrl, setBackendUrlState] = useState(defaultBackendUrl);
  const [subscriptionKey, setSubscriptionKeyState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Restore saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.expiry && Date.now() < saved.expiry) {
            setState({
              token: saved.token,
              userId: saved.userId,
              role: saved.role,
              username: saved.username,
            });
          } else {
            await SecureStore.deleteItemAsync(STORAGE_KEY);
          }
          if (saved.backendUrl) setBackendUrlState(saved.backendUrl);
          if (saved.subscriptionKey) setSubscriptionKeyState(saved.subscriptionKey);
        }
      } catch (e) {
        console.warn('Failed to restore auth state', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setBackendUrl = useCallback((url: string) => {
    setBackendUrlState(url);
  }, []);

  const setSubscriptionKey = useCallback((key: string) => {
    setSubscriptionKeyState(key);
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const result = await apiLogin(backendUrl, username, password, subscriptionKey);
      const next: AuthState = {
        token: result.access_token,
        userId: result.user_id,
        role: result.role,
        username,
      };
      setState(next);
      await SecureStore.setItemAsync(
        STORAGE_KEY,
        JSON.stringify({
          ...next,
          backendUrl,
          subscriptionKey,
          expiry: Date.now() + result.expires_in * 1000,
        }),
      );
    },
    [backendUrl],
  );

  const signOut = useCallback(async () => {
    setState({ token: null, userId: null, role: null, username: null });
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, backendUrl, setBackendUrl, subscriptionKey, setSubscriptionKey, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
