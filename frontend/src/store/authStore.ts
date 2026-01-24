import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  setAuth: async (token: string, user: User) => {
    // Store to AsyncStorage
    try {
      await AsyncStorage.setItem('auth-token', token);
      await AsyncStorage.setItem('auth-user', JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save auth:', e);
    }
    
    set({
      token,
      user,
      isAuthenticated: true
    });
  },
  
  logout: async () => {
    // Clear from AsyncStorage
    try {
      await AsyncStorage.removeItem('auth-token');
      await AsyncStorage.removeItem('auth-user');
    } catch (e) {
      console.error('Failed to clear auth:', e);
    }
    
    set({
      token: null,
      user: null,
      isAuthenticated: false
    });
  },
  
  loadStoredAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('auth-token');
      const userStr = await AsyncStorage.getItem('auth-user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to load auth:', e);
      set({ isLoading: false });
    }
  }
}));
