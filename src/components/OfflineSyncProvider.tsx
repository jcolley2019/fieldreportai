import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncOfflineQueue, onSyncProgress, type SyncProgress } from '@/lib/offlineSync';
import { getPendingCounts } from '@/lib/offlineQueue';
import { toast } from 'sonner';
import { WifiOff, Wifi, CloudUpload } from 'lucide-react';

/**
 * Renders an offline/syncing banner and auto-syncs when connectivity returns.
 * Drop this into App.tsx — it doesn't wrap children, just renders a banner.
 */
const OfflineSyncProvider = () => {
  const isOnline = useOnlineStatus();
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);

  // Track offline → online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  // Refresh pending counts periodically when offline
  useEffect(() => {
    if (isOnline) return;

    const refresh = async () => {
      const counts = await getPendingCounts();
      setPendingCount(counts.media + counts.notes);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Auto-sync when back online
  useEffect(() => {
    if (!isOnline || !wasOffline) return;

    const doSync = async () => {
      const counts = await getPendingCounts();
      const total = counts.media + counts.notes;
      if (total === 0) {
        setWasOffline(false);
        return;
      }

      toast.info(`Back online — syncing ${total} queued item${total > 1 ? 's' : ''}...`);
      const result = await syncOfflineQueue();

      if (result.failed === 0 && result.completed > 0) {
        toast.success(`Synced ${result.completed} item${result.completed > 1 ? 's' : ''} successfully!`);
      } else if (result.failed > 0) {
        toast.warning(`Synced ${result.completed}/${result.total} — ${result.failed} failed. Will retry.`);
      }

      setPendingCount(result.failed);
      setWasOffline(false);
    };

    // Small delay to let the connection stabilize
    const timeout = setTimeout(doSync, 2000);
    return () => clearTimeout(timeout);
  }, [isOnline, wasOffline]);

  // Listen to sync progress
  useEffect(() => {
    return onSyncProgress(setSyncProgress);
  }, []);

  // Don't show anything if online and nothing pending
  if (isOnline && pendingCount === 0 && !syncProgress?.inProgress) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 pointer-events-auto">
          <WifiOff className="h-4 w-4" />
          <span>
            You're offline
            {pendingCount > 0 && ` — ${pendingCount} item${pendingCount > 1 ? 's' : ''} queued`}
          </span>
        </div>
      )}

      {/* Syncing banner */}
      {isOnline && syncProgress?.inProgress && (
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 pointer-events-auto">
          <CloudUpload className="h-4 w-4 animate-pulse" />
          <span>
            Syncing {syncProgress.completed}/{syncProgress.total}...
          </span>
        </div>
      )}
    </div>
  );
};

export default OfflineSyncProvider;
