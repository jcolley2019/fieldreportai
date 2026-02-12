import { useState, useEffect } from 'react';
import { getWorkOfflineMode, setWorkOfflineMode } from '@/lib/offlineMode';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Returns whether the app should behave as offline.
 * True when either:
 *  - The device genuinely has no connectivity, OR
 *  - The user has toggled "Work Offline" in Settings
 */
export function useEffectiveOffline() {
  const isOnline = useOnlineStatus();
  const [workOffline, setWorkOffline] = useState(getWorkOfflineMode);

  useEffect(() => {
    const handler = (e: Event) => {
      setWorkOffline((e as CustomEvent).detail);
    };
    window.addEventListener('work-offline-changed', handler);
    return () => window.removeEventListener('work-offline-changed', handler);
  }, []);

  return {
    /** True = app should skip network calls */
    isEffectivelyOffline: !isOnline || workOffline,
    /** True = device has no network */
    isDeviceOffline: !isOnline,
    /** True = user manually chose offline mode */
    workOfflineEnabled: workOffline,
    /** Toggle the manual work-offline preference */
    setWorkOffline: setWorkOfflineMode,
  };
}
