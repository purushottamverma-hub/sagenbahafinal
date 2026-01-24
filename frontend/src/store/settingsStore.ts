import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Language } from '../i18n/translations';

interface SettingsState {
  language: Language;
  isLoaded: boolean;
  setLanguage: (lang: Language) => void;
  hydrate: () => Promise<void>;
}

// Storage key
const SETTINGS_STORAGE_KEY = 'fpo-settings-storage';

// Helper functions for storage
const getStorage = async (): Promise<{ language: Language } | null> => {
  try {
    if (Platform.OS === 'web') {
      const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return item ? JSON.parse(item) : null;
    }
    const item = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setStorage = async (data: { language: Language }): Promise<void> => {
  try {
    const value = JSON.stringify(data);
    if (Platform.OS === 'web') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, value);
    } else {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, value);
    }
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  language: 'hi', // Default to Hindi
  isLoaded: false,
  
  setLanguage: async (lang: Language) => {
    set({ language: lang });
    await setStorage({ language: lang });
  },
  
  hydrate: async () => {
    const stored = await getStorage();
    if (stored && stored.language) {
      set({ language: stored.language, isLoaded: true });
    } else {
      set({ isLoaded: true });
    }
  },
}));
