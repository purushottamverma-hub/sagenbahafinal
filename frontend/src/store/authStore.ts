import { create, StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'agent' | 'farmer';
  outlet_id: string | null;
  village?: string;
  mobile?: string;
  status?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  getToken: () => string | null;
}

// Storage key
const AUTH_STORAGE_KEY = 'fpo-auth-storage';

// Debug logging helper
const logAuth = (action: string, data?: any) => {
  if (__DEV__) {
    console.log(`[AuthStore] ${action}`, data || '');
  }
};

// Helper functions for storage with retry logic
const getStorage = async (retryCount = 0): Promise<{ token: string | null; user: User | null; isAuthenticated: boolean } | null> => {
  const maxRetries = 3;
  
  try {
    let item: string | null = null;
    
    if (Platform.OS === 'web') {
      item = localStorage.getItem(AUTH_STORAGE_KEY);
    } else {
      item = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    }
    
    if (item) {
      const parsed = JSON.parse(item);
      logAuth('Retrieved from storage', { hasToken: !!parsed?.token, user: parsed?.user?.username });
      return parsed;
    }
    
    logAuth('No data in storage');
    return null;
  } catch (error) {
    console.error(`[AuthStore] Failed to read storage (attempt ${retryCount + 1}):`, error);
    
    // Retry for native platforms
    if (Platform.OS !== 'web' && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
      return getStorage(retryCount + 1);
    }
    
    return null;
  }
};

const setStorage = async (data: { token: string | null; user: User | null; isAuthenticated: boolean }): Promise<boolean> => {
  try {
    const value = JSON.stringify(data);
    
    if (Platform.OS === 'web') {
      localStorage.setItem(AUTH_STORAGE_KEY, value);
    } else {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, value);
    }
    
    // Verify the write was successful
    const verification = await getStorage();
    if (!verification || verification.token !== data.token) {
      console.error('[AuthStore] Storage verification failed!');
      return false;
    }
    
    logAuth('Saved to storage successfully', { hasToken: !!data.token });
    return true;
  } catch (e) {
    console.error('[AuthStore] Failed to save auth:', e);
    return false;
  }
};

const clearStorage = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
    
    logAuth('Storage cleared');
    return true;
  } catch (e) {
    console.error('[AuthStore] Failed to clear auth:', e);
    return false;
  }
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  setAuth: async (token: string, user: User) => {
    // Persist to storage first
    await setStorage({ token, user, isAuthenticated: true });
    
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },
  
  logout: async () => {
    // Clear storage first
    await clearStorage();
    
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
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
