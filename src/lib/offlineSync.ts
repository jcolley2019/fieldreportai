/**
 * Offline Sync Service — uploads queued media, notes, tasks and checklists when back online.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getPendingMedia,
  removePendingMedia,
  getPendingNotes,
  removePendingNote,
  getPendingTasks,
  removePendingTask,
  getPendingChecklists,
  removePendingChecklist,
  arrayBufferToFile,
  type PendingMediaItem,
  type PendingNoteItem,
  type PendingTaskItem,
  type PendingChecklistItem,
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

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file, { contentType: item.mimeType });

    if (uploadError) {
      console.error('Offline sync: upload failed', uploadError);
      return false;
    }

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

async function uploadTaskItem(item: PendingTaskItem): Promise<boolean> {
  try {
    const { error } = await supabase.from('tasks').insert({
      user_id: item.userId,
      report_id: item.reportId ?? null,
      title: item.title,
      description: item.description ?? null,
      priority: item.priority,
      status: item.status,
    });

    if (error) {
      console.error('Offline sync: task insert failed', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Offline sync: unexpected error', err);
    return false;
  }
}

async function uploadChecklistItem(item: PendingChecklistItem): Promise<boolean> {
  try {
    // Create or find a report if needed
    let reportId = item.reportId ?? null;
    if (!reportId) {
      const { data: newReport, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: item.userId,
          project_name: item.title,
          customer_name: 'Standalone Checklist',
          job_number: `CL-${Date.now()}`,
          job_description: `Checklist: ${item.title}`,
        })
        .select()
        .single();
      if (reportError || !newReport) {
        console.error('Offline sync: checklist report create failed', reportError);
        return false;
      }
      reportId = newReport.id;
    }

    const { data: newChecklist, error: checklistError } = await supabase
      .from('checklists')
      .insert({ user_id: item.userId, report_id: reportId, title: item.title })
      .select()
      .single();

    if (checklistError || !newChecklist) {
      console.error('Offline sync: checklist insert failed', checklistError);
      return false;
    }

    const itemsToInsert = item.items.map((i) => ({
      checklist_id: newChecklist.id,
      text: i.text,
      priority: i.priority,
      category: i.category,
      completed: i.completed,
    }));

    const { error: itemsError } = await supabase.from('checklist_items').insert(itemsToInsert);
    if (itemsError) {
      console.error('Offline sync: checklist items insert failed', itemsError);
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

  const [pendingMedia, pendingNotes, pendingTasks, pendingChecklists] = await Promise.all([
    getPendingMedia(),
    getPendingNotes(),
    getPendingTasks(),
    getPendingChecklists(),
  ]);

  const total = pendingMedia.length + pendingNotes.length + pendingTasks.length + pendingChecklists.length;

  if (total === 0) {
    isSyncing = false;
    return { total: 0, completed: 0, failed: 0, inProgress: false };
  }

  let completed = 0;
  let failed = 0;

  const progress = (): SyncProgress => ({ total, completed, failed, inProgress: true });
  notify(progress());

  for (const item of pendingMedia) {
    const ok = await uploadMediaItem(item);
    if (ok) { await removePendingMedia(item.id); completed++; } else { failed++; }
    notify(progress());
  }

  for (const item of pendingNotes) {
    const ok = await uploadNoteItem(item);
    if (ok) { await removePendingNote(item.id); completed++; } else { failed++; }
    notify(progress());
  }

  for (const item of pendingTasks) {
    const ok = await uploadTaskItem(item);
    if (ok) { await removePendingTask(item.id); completed++; } else { failed++; }
    notify(progress());
  }

  for (const item of pendingChecklists) {
    const ok = await uploadChecklistItem(item);
    if (ok) { await removePendingChecklist(item.id); completed++; } else { failed++; }
    notify(progress());
  }

  isSyncing = false;
  const final: SyncProgress = { total, completed, failed, inProgress: false };
  notify(final);
  return final;
}
