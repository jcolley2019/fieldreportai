/**
 * Offline Sync Service — uploads queued media and notes when back online.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getPendingMedia,
  removePendingMedia,
  getPendingNotes,
  removePendingNote,
  arrayBufferToFile,
  type PendingMediaItem,
  type PendingNoteItem,
} from './offlineQueue';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

type SyncListener = (progress: SyncProgress) => void;

let isSyncing = false;
const listeners: Set<SyncListener> = new Set();

function notify(progress: SyncProgress) {
  listeners.forEach((fn) => fn(progress));
}

export function onSyncProgress(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function uploadMediaItem(item: PendingMediaItem): Promise<boolean> {
  try {
    const file = arrayBufferToFile(item.fileData, item.fileName, item.mimeType);
    const filePath = `${item.userId}/${item.reportId}/${Date.now()}-${item.fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file, { contentType: item.mimeType });

    if (uploadError) {
      console.error('Offline sync: upload failed', uploadError);
      return false;
    }

    // Insert media record
    const { error: dbError } = await supabase.from('media').insert({
      user_id: item.userId,
      report_id: item.reportId,
      file_path: filePath,
      file_type: item.fileType,
      mime_type: item.mimeType,
      file_size: item.fileSize,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      captured_at: item.capturedAt ?? new Date().toISOString(),
      location_name: item.locationName ?? null,
    });

    if (dbError) {
      console.error('Offline sync: db insert failed', dbError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Offline sync: unexpected error', err);
    return false;
  }
}

async function uploadNoteItem(item: PendingNoteItem): Promise<boolean> {
  try {
    const { error } = await supabase.from('notes').insert({
      user_id: item.userId,
      report_id: item.reportId ?? null,
      note_text: item.noteText,
    });

    if (error) {
      console.error('Offline sync: note insert failed', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Offline sync: unexpected error', err);
    return false;
  }
}

export async function syncOfflineQueue(): Promise<SyncProgress> {
  if (isSyncing) return { total: 0, completed: 0, failed: 0, inProgress: true };

  isSyncing = true;

  const pendingMedia = await getPendingMedia();
  const pendingNotes = await getPendingNotes();
  const total = pendingMedia.length + pendingNotes.length;

  if (total === 0) {
    isSyncing = false;
    return { total: 0, completed: 0, failed: 0, inProgress: false };
  }

  let completed = 0;
  let failed = 0;

  const progress = (): SyncProgress => ({ total, completed, failed, inProgress: true });

  notify(progress());

  // Upload media
  for (const item of pendingMedia) {
    const ok = await uploadMediaItem(item);
    if (ok) {
      await removePendingMedia(item.id);
      completed++;
    } else {
      failed++;
    }
    notify(progress());
  }

  // Upload notes
  for (const item of pendingNotes) {
    const ok = await uploadNoteItem(item);
    if (ok) {
      await removePendingNote(item.id);
      completed++;
    } else {
      failed++;
    }
    notify(progress());
  }

  isSyncing = false;
  const final: SyncProgress = { total, completed, failed, inProgress: false };
  notify(final);
  return final;
}
