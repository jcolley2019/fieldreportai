import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import { supabase } from '@/integrations/supabase/client';

// Initialize with default language
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    lng: 'en', // default language
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
        .single();
      
      if (profile?.preferred_language) {
        i18n.changeLanguage(profile.preferred_language);
      }
    }
  } catch (error) {
    console.error('Error loading user language:', error);
  }
};

// Load language on initialization
loadUserLanguage();

export default i18n;
