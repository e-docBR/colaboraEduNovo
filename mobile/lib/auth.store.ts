/**
 * Auth store — persists JWT and user data in Expo SecureStore.
 * Uses Zustand for reactive state management.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';
import type { LoginResponse } from './api';

type User = LoginResponse['user'];

/** Inactivity timeout: 30 minutes in milliseconds */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Call after successful login API response */
  signIn: (token: string, user: User) => Promise<void>;

  /** Clears all credentials and navigates to login */
  signOut: () => Promise<void>;

  /** Rehydrate state from SecureStore on app boot */
  rehydrate: () => Promise<void>;

  /** Update the last activity timestamp (call on any user interaction) */
  touchActivity: () => Promise<void>;
}

/** Module-level timer so it survives re-renders */
let _inactivityTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInactivityLogout(signOut: () => Promise<void>) {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    signOut();
  }, INACTIVITY_TIMEOUT_MS);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  signIn: async (token, user) => {
    await SecureStore.setItemAsync('access_token', token);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    await SecureStore.setItemAsync('last_active', String(Date.now()));
    set({ token, user, isAuthenticated: true });
    scheduleInactivityLogout(get().signOut);
  },

  signOut: async () => {
    if (_inactivityTimer) {
      clearTimeout(_inactivityTimer);
      _inactivityTimer = null;
    }
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('last_active');
    set({ token: null, user: null, isAuthenticated: false });
  },

  touchActivity: async () => {
    if (!get().isAuthenticated) return;
    await SecureStore.setItemAsync('last_active', String(Date.now()));
    scheduleInactivityLogout(get().signOut);
  },

  rehydrate: async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('access_token');
      const storedUser = await SecureStore.getItemAsync('user_data');
      const lastActive = await SecureStore.getItemAsync('last_active');

      if (storedToken && storedUser) {
        // Check if session expired while app was closed
        const elapsed = Date.now() - Number(lastActive ?? 0);
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          // Session timed out — clear everything
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('user_data');
          await SecureStore.deleteItemAsync('last_active');
          set({ isLoading: false });
          return;
        }
        set({
          token: storedToken,
          user: JSON.parse(storedUser) as User,
          isAuthenticated: true,
          isLoading: false,
        });
        scheduleInactivityLogout(get().signOut);
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

// Restart the inactivity timer whenever the app comes back to foreground
AppState.addEventListener('change', (nextState: AppStateStatus) => {
  if (nextState === 'active') {
    const { isAuthenticated, signOut } = useAuthStore.getState();
    if (isAuthenticated) {
      SecureStore.getItemAsync('last_active').then((lastActive) => {
        const elapsed = Date.now() - Number(lastActive ?? 0);
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          signOut();
        } else {
          scheduleInactivityLogout(signOut);
        }
      });
    }
  }
});

