import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CloudUpload, Image, FileText, Trash2, WifiOff } from 'lucide-react';
import { getPendingMedia, getPendingNotes, getPendingTasks, getPendingChecklists, removePendingMedia, removePendingNote, removePendingTask, removePendingChecklist, type PendingMediaItem, type PendingNoteItem, type PendingTaskItem, type PendingChecklistItem } from '@/lib/offlineQueue';
import { syncOfflineQueue, onSyncProgress, type SyncProgress } from '@/lib/offlineSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEffectiveOffline } from '@/hooks/useEffectiveOffline';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const OfflineQueueCard = () => {
  const isOnline = useOnlineStatus();
  const { isEffectivelyOffline, workOfflineEnabled } = useEffectiveOffline();
  const [mediaItems, setMediaItems] = useState<PendingMediaItem[]>([]);
  const [noteItems, setNoteItems] = useState<PendingNoteItem[]>([]);
  const [taskItems, setTaskItems] = useState<PendingTaskItem[]>([]);
  const [checklistItems, setChecklistItems] = useState<PendingChecklistItem[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    try {
      const [media, notes, tasks, checklists] = await Promise.all([
        getPendingMedia(), getPendingNotes(), getPendingTasks(), getPendingChecklists()
      ]);
      setMediaItems(media);
      setNoteItems(notes);
      setTaskItems(tasks);
      setChecklistItems(checklists);
    } catch (err) {
      console.error('Error loading offline queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return onSyncProgress((progress) => {
      setSyncProgress(progress);
      if (!progress.inProgress) {
        loadQueue();
      }
    });
  }, []);

  const totalPending = mediaItems.length + noteItems.length + taskItems.length + checklistItems.length;

  // Don't show if nothing queued and not in work-offline mode
  if (!loading && totalPending === 0 && !workOfflineEnabled) return null;

  const handleSync = async () => {
    if (!isOnline) {
      toast.error("You're offline. Connect to the internet to sync.");
      return;
    }
    const result = await syncOfflineQueue();
    if (result.failed === 0 && result.completed > 0) {
      toast.success(`Synced ${result.completed} item${result.completed > 1 ? 's' : ''} successfully!`);
    } else if (result.failed > 0) {
      toast.warning(`${result.completed} synced, ${result.failed} failed. Try again.`);
    } else if (result.total === 0) {
      toast.info("Nothing to sync.");
    }
  };

  const handleDeleteItem = async (type: 'media' | 'note' | 'task' | 'checklist', id: string) => {
    try {
      if (type === 'media') await removePendingMedia(id);
      else if (type === 'note') await removePendingNote(id);
      else if (type === 'task') await removePendingTask(id);
      else if (type === 'checklist') await removePendingChecklist(id);
      await loadQueue();
      toast.success("Item removed from queue.");
    } catch {
      toast.error("Failed to remove item.");
    }
  };

  const photoCount = mediaItems.filter(m => m.fileType === 'photo').length;
  const videoCount = mediaItems.filter(m => m.fileType === 'video').length;

  return (
    <section className="mb-8">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              {isEffectivelyOffline ? (
                <WifiOff className="h-5 w-5 text-destructive" />
              ) : (
                <CloudUpload className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Offline Queue</h3>
              <p className="text-xs text-muted-foreground">
                {workOfflineEnabled && isOnline
                  ? "Work Offline mode is on"
                  : !isOnline
                    ? "No connection — items queued locally"
                    : `${totalPending} item${totalPending !== 1 ? 's' : ''} waiting to sync`
                }
              </p>
            </div>
          </div>
          {totalPending > 0 && (
            <Button
              onClick={handleSync}
              size="sm"
              disabled={!isOnline || syncProgress?.inProgress}
              className="gap-2"
            >
              <CloudUpload className="h-4 w-4" />
              {syncProgress?.inProgress ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
        </div>

        {/* Sync progress bar */}
        {syncProgress?.inProgress && (
          <div className="mb-4">
            <Progress
              value={(syncProgress.completed / syncProgress.total) * 100}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {syncProgress.completed}/{syncProgress.total} uploaded...
            </p>
          </div>
        )}

        {/* Queue summary */}
        {totalPending > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {photoCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Image className="h-4 w-4" />
                  {photoCount} photo{photoCount !== 1 ? 's' : ''}
                </span>
              )}
              {videoCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Image className="h-4 w-4" />
                  {videoCount} video{videoCount !== 1 ? 's' : ''}
                </span>
              )}
              {noteItems.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {noteItems.length} note{noteItems.length !== 1 ? 's' : ''}
                </span>
              )}
              {taskItems.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {taskItems.length} task{taskItems.length !== 1 ? 's' : ''}
                </span>
              )}
              {checklistItems.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {checklistItems.length} checklist{checklistItems.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Media thumbnails */}
            {mediaItems.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2">
                {mediaItems.slice(0, 8).map((item) => (
                  <div key={item.id} className="relative flex-shrink-0 group">
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {item.fileType === 'photo' ? (
                        <img
                          src={URL.createObjectURL(new Blob([item.fileData], { type: item.mimeType }))}
                          alt={item.caption || 'Queued photo'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem('media', item.id)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {mediaItems.length > 8 && (
                  <div className="h-16 w-16 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">+{mediaItems.length - 8}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state when in work offline mode but nothing queued */}
        {totalPending === 0 && workOfflineEnabled && (
          <p className="text-sm text-muted-foreground">
            No items queued yet. Capture photos and notes — they'll be saved locally until you sync.
          </p>
        )}
      </div>
    </section>
  );
};

export default OfflineQueueCard;
