import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

// Simple localStorage wrapper for web
const webStorage = {
  getItem: (name: string) => {
    try {
      const value = localStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch {}
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

// Use localStorage on web, AsyncStorage on native
const storage = Platform.OS === 'web' 
  ? {
      getItem: async (name: string) => webStorage.getItem(name),
      setItem: async (name: string, value: string) => webStorage.setItem(name, JSON.parse(value)),
      removeItem: async (name: string) => webStorage.removeItem(name),
    }
  : createJSONStorage(() => AsyncStorage);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (token: string, user: User) => set({
        token,
        user,
        isAuthenticated: true
      }),
      logout: () => set({
        token: null,
        user: null,
        isAuthenticated: false
      }),
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: storage,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
