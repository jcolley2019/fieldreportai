/**
 * Manages the "Work Offline" preference stored in localStorage.
 * This is a device-level setting — not synced to the server.
 */

const OFFLINE_MODE_KEY = 'fieldreport-work-offline';

export function getWorkOfflineMode(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setWorkOfflineMode(enabled: boolean): void {
  try {
    localStorage.setItem(OFFLINE_MODE_KEY, enabled ? 'true' : 'false');
    // Dispatch a custom event so all hooks/components react instantly
    window.dispatchEvent(new CustomEvent('work-offline-changed', { detail: enabled }));
  } catch {
    // localStorage may be unavailable
  }
}
