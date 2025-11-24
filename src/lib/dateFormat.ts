import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import i18n from '@/i18n/config';

/**
 * Format a date according to the current language setting
 * English: MM/DD/YYYY (e.g., 12/31/2024)
 * Spanish: DD/MM/YYYY (e.g., 31/12/2024)
 */
export const formatDate = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const currentLanguage = i18n.language;

  if (currentLanguage === 'es') {
    return format(dateObj, 'dd/MM/yyyy', { locale: es });
  }
  
  // Default to English format
  return format(dateObj, 'MM/dd/yyyy');
};

/**
 * Format a date with time according to the current language setting
 * English: MM/DD/YYYY at h:mm a (e.g., 12/31/2024 at 3:45 PM)
 * Spanish: DD/MM/YYYY a las HH:mm (e.g., 31/12/2024 a las 15:45)
 */
export const formatDateTime = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const currentLanguage = i18n.language;

  if (currentLanguage === 'es') {
    return format(dateObj, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
  }
  
  // Default to English format
  return format(dateObj, "MM/dd/yyyy 'at' h:mm a");
};

/**
 * Format a date in a long format according to the current language
 * English: December 31, 2024
 * Spanish: 31 de diciembre de 2024
 */
export const formatDateLong = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const currentLanguage = i18n.language;

  if (currentLanguage === 'es') {
    return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: es });
  }
  
  // Default to English format
  return format(dateObj, 'MMMM d, yyyy');
};

/**
 * Format a date for display in reports and documents
 * Uses long format for better readability
 */
export const formatReportDate = (date: Date | string | number): string => {
  return formatDateLong(date);
};

/**
 * Format a relative time (e.g., "2 hours ago", "hace 2 horas")
 * This is a simple implementation - can be enhanced with date-fns formatDistanceToNow
 */
export const formatRelativeTime = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  const currentLanguage = i18n.language;

  if (diffInSeconds < 60) {
    return currentLanguage === 'es' ? 'Hace unos segundos' : 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return currentLanguage === 'es' 
      ? `Hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`
      : `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return currentLanguage === 'es'
      ? `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`
      : `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return currentLanguage === 'es'
      ? `Hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`
      : `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
  
  // For older dates, show the full date
  return formatDate(dateObj);
};
