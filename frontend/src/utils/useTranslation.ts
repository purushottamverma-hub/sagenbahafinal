import { translations, TranslationKey } from '../i18n/translations';
import { useSettingsStore } from '../store/settingsStore';

export const useTranslation = () => {
  const language = useSettingsStore((state) => state.language);
  
  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };
  
  return { t, language };
};
