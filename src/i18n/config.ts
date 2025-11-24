import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import { supabase } from '@/integrations/supabase/client';

// Detect browser language
const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
  const supportedLanguages = ['en', 'es'];
  return supportedLanguages.includes(browserLang) ? browserLang : 'en';
};

// Initialize with browser language detection
const initialLanguage = detectBrowserLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    lng: initialLanguage, // Use detected browser language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Load user's preferred language from database
const loadUserLanguage = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .maybeSingle();
      
      // Only override if user has explicitly set a language preference
      if (profile?.preferred_language) {
        i18n.changeLanguage(profile.preferred_language);
      }
      // Otherwise, keep the browser-detected language
    }
  } catch (error) {
    console.error('Error loading user language:', error);
    // Keep browser-detected language on error
  }
};

// Load language on initialization
loadUserLanguage();

export default i18n;
