import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'agent';
  outlet_id: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

// Custom storage adapter that works on both web and native
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    }
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(name, value);
      } catch {
        console.error('Failed to save to localStorage');
      }
      return;
    }
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(name);
      } catch {
        console.error('Failed to remove from localStorage');
      }
      return;
    }
    await AsyncStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,
      
      setAuth: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },
      
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state, isLoading: !state });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
