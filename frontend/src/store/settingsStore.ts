import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Language } from '../i18n/translations';

interface SettingsState {
  language: Language;
  _hasHydrated: boolean;
  setLanguage: (lang: Language) => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'hi', // Default to Hindi
      _hasHydrated: false,
      
      setLanguage: (lang: Language) => {
        set({ language: lang });
      },
      
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
