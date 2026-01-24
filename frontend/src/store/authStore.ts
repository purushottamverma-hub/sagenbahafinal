import { create, StateCreator } from 'zustand';
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
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

// Storage key
const AUTH_STORAGE_KEY = 'fpo-auth-storage';

// Helper functions for storage
const getStorage = async (): Promise<{ token: string | null; user: User | null; isAuthenticated: boolean } | null> => {
  try {
    if (Platform.OS === 'web') {
      const item = localStorage.getItem(AUTH_STORAGE_KEY);
      return item ? JSON.parse(item) : null;
    }
    const item = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setStorage = async (data: { token: string | null; user: User | null; isAuthenticated: boolean }): Promise<void> => {
  try {
    const value = JSON.stringify(data);
    if (Platform.OS === 'web') {
      localStorage.setItem(AUTH_STORAGE_KEY, value);
    } else {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, value);
    }
  } catch (e) {
    console.error('Failed to save auth:', e);
  }
};

const clearStorage = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to clear auth:', e);
  }
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  setAuth: async (token: string, user: User) => {
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
    
    // Persist to storage
    await setStorage({ token, user, isAuthenticated: true });
  },
  
  logout: async () => {
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    
    // Clear storage
    await clearStorage();
  },
  
  hydrate: async () => {
    const stored = await getStorage();
    if (stored && stored.token && stored.user) {
      set({
        token: stored.token,
        user: stored.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },
}));
