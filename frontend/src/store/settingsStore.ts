import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../i18n/translations';

interface SettingsState {
  language: Language;
  isLoaded: boolean;
  setLanguage: (lang: Language) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'hi', // Default to Hindi
  isLoaded: false,
  
  setLanguage: async (lang: Language) => {
    try {
      await AsyncStorage.setItem('app-language', lang);
    } catch (e) {
      console.error('Failed to save language:', e);
    }
    set({ language: lang });
  },
  
  loadSettings: async () => {
    try {
      const lang = await AsyncStorage.getItem('app-language');
      if (lang && (lang === 'en' || lang === 'hi')) {
        set({ language: lang as Language, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoaded: true });
    }
  }
}));
