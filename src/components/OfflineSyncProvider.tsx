import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEffectiveOffline } from '@/hooks/useEffectiveOffline';
import { syncOfflineQueue, onSyncProgress, type SyncProgress } from '@/lib/offlineSync';
import { getPendingCounts } from '@/lib/offlineQueue';
import { setWorkOfflineMode } from '@/lib/offlineMode';
import { toast } from 'sonner';
import { WifiOff, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Renders an offline/syncing banner and auto-syncs when connectivity returns.
 * Also shows a prompt when connectivity is lost asking user to switch to offline mode.
 */
const OfflineSyncProvider = () => {
  const isOnline = useOnlineStatus();
  const { workOfflineEnabled } = useEffectiveOffline();
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  // Show auto-prompt when connectivity drops (only once per session)
  useEffect(() => {
    if (!isOnline && !workOfflineEnabled && !hasPrompted) {
      setShowOfflinePrompt(true);
      setHasPrompted(true);
    }
  }, [isOnline, workOfflineEnabled, hasPrompted]);

  // Track offline → online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  // Refresh pending counts when offline
  useEffect(() => {
    if (isOnline && !workOfflineEnabled) return;

    const refresh = async () => {
      const counts = await getPendingCounts();
      setPendingCount(counts.media + counts.notes);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isOnline, workOfflineEnabled]);

  // Auto-sync when back online (only if not in manual work-offline mode)
  useEffect(() => {
    if (!isOnline || !wasOffline || workOfflineEnabled) return;

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

    const timeout = setTimeout(doSync, 2000);
    return () => clearTimeout(timeout);
  }, [isOnline, wasOffline, workOfflineEnabled]);

  // Listen to sync progress
  useEffect(() => {
    return onSyncProgress(setSyncProgress);
  }, []);

  const handleEnableOfflineMode = () => {
    setWorkOfflineMode(true);
    setShowOfflinePrompt(false);
    toast.success("Work Offline mode enabled. Your captures will be saved locally.");
  };

  // Don't show banner if online, nothing pending, and not syncing
  const showBanner = (!isOnline || (workOfflineEnabled && pendingCount > 0) || syncProgress?.inProgress);

  return (
    <>
      {/* Auto-prompt dialog */}
      <Dialog open={showOfflinePrompt} onOpenChange={setShowOfflinePrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-destructive" />
              No Connection Detected
            </DialogTitle>
            <DialogDescription>
              It looks like you've lost your internet connection. Would you like to switch to Work Offline mode? 
              Your photos, videos, and notes will be saved locally and synced when you're back online.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowOfflinePrompt(false)}>
              Not Now
            </Button>
            <Button onClick={handleEnableOfflineMode}>
              <WifiOff className="mr-2 h-4 w-4" />
              Work Offline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
          {!isOnline && (
            <div className="bg-destructive text-destructive-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 pointer-events-auto">
              <WifiOff className="h-4 w-4" />
              <span>
                You're offline
                {workOfflineEnabled && ' (Work Offline mode)'}
                {pendingCount > 0 && ` — ${pendingCount} item${pendingCount > 1 ? 's' : ''} queued`}
              </span>
            </div>
          )}

          {isOnline && syncProgress?.inProgress && (
            <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 pointer-events-auto">
              <CloudUpload className="h-4 w-4 animate-pulse" />
              <span>
                Syncing {syncProgress.completed}/{syncProgress.total}...
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default OfflineSyncProvider;
