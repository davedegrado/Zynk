import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthResponse, Me } from '@zynk/shared';
import { api, setApiToken, setUnauthorizedHandler } from './api';
import { queryClient } from './query';

const TOKEN_KEY = 'zynk.session';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  user: Me | null;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
  setUser: (me: Me) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Hooks other modules run on sign-out (push token removal, purchases logout). */
const signOutHooks = new Set<() => Promise<void> | void>();
export const onSignOut = (fn: () => Promise<void> | void) => {
  signOutHooks.add(fn);
  return () => signOutHooks.delete(fn);
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const signingOut = useRef(false);

  const clearLocal = useCallback(async () => {
    setApiToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const signOut = useCallback(
    async (opts: { remote?: boolean } = {}) => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        for (const hook of signOutHooks) await Promise.resolve(hook()).catch(() => undefined);
        if (opts.remote !== false) await api.logout().catch(() => undefined);
        await clearLocal();
      } finally {
        signingOut.current = false;
      }
    },
    [clearLocal],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut({ remote: false }));
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!stored) return setStatus('signedOut');
      setApiToken(stored);
      try {
        setUser(await api.me());
        setStatus('signedIn');
      } catch (err) {
        // Offline at launch: keep the session; screens will retry.
        if ((err as { code?: string }).code === 'network') setStatus('signedIn');
        else await clearLocal();
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearLocal, signOut]);

  const signIn = useCallback(async (auth: AuthResponse) => {
    await SecureStore.setItemAsync(TOKEN_KEY, auth.token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    setApiToken(auth.token);
    queryClient.clear();
    setUser(auth.user);
    setStatus('signedIn');
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut, setUser }), [status, user, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
