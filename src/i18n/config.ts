import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import { supabase } from '@/integrations/supabase/client';

// Detect browser language or use localStorage
const detectBrowserLanguage = (): string => {
  // First check localStorage (for pre-login preference)
  const storedLanguage = localStorage.getItem('preferred_language');
  if (storedLanguage && ['en', 'es'].includes(storedLanguage)) {
    return storedLanguage;
  }
  
  // Then check browser language
  const browserLang = navigator.language.split('-')[0];
  const supportedLanguages = ['en', 'es'];
  return supportedLanguages.includes(browserLang) ? browserLang : 'en';
};

// Initialize with detected language
const initialLanguage = detectBrowserLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Load user's preferred language from database (after login)
const loadUserLanguage = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .maybeSingle();
      
      // Only override if user has explicitly set a language preference in database
      if (profile?.preferred_language) {
        i18n.changeLanguage(profile.preferred_language);
        // Also update localStorage to keep it in sync
        localStorage.setItem('preferred_language', profile.preferred_language);
      }
    }
  } catch (error) {
    console.error('Error loading user language:', error);
    // Keep browser-detected or localStorage language on error
  }
};

// Load language on initialization
loadUserLanguage();

export default i18n;
