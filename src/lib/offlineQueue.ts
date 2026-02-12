/**
 * Offline Media Queue — stores captured media in IndexedDB when offline,
 * and syncs to the backend when connectivity returns.
 */

const DB_NAME = 'fieldreport-offline';
const DB_VERSION = 1;
const STORE_MEDIA = 'pending-media';
const STORE_NOTES = 'pending-notes';

export interface PendingMediaItem {
  id: string;
  reportId: string;
  userId: string;
  fileData: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileType: 'photo' | 'video';
  fileSize: number;
  caption?: string;
  voiceNote?: string;
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
  locationName?: string;
  createdAt: string;
}

export interface PendingNoteItem {
  id: string;
  reportId?: string;
  userId: string;
  noteText: string;
  audioData?: ArrayBuffer;
  audioMimeType?: string;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Media Queue ───

export async function queueMedia(item: PendingMediaItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingMedia(): Promise<PendingMediaItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const request = tx.objectStore(STORE_MEDIA).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingMedia(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Notes Queue ───

export async function queueNote(item: PendingNoteItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTES, 'readwrite');
    tx.objectStore(STORE_NOTES).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingNotes(): Promise<PendingNoteItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTES, 'readonly');
    const request = tx.objectStore(STORE_NOTES).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingNote(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTES, 'readwrite');
    tx.objectStore(STORE_NOTES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Counts ───

export async function getPendingCounts(): Promise<{ media: number; notes: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MEDIA, STORE_NOTES], 'readonly');
    const mediaReq = tx.objectStore(STORE_MEDIA).count();
    const notesReq = tx.objectStore(STORE_NOTES).count();
    
    let media = 0;
    let notes = 0;
    
    mediaReq.onsuccess = () => { media = mediaReq.result; };
    notesReq.onsuccess = () => { notes = notesReq.result; };
    
    tx.oncomplete = () => resolve({ media, notes });
    tx.onerror = () => reject(tx.error);
  });
}

/** Convert a File to an ArrayBuffer for IndexedDB storage */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Convert an ArrayBuffer back to a File */
export function arrayBufferToFile(buffer: ArrayBuffer, name: string, mimeType: string): File {
  return new File([buffer], name, { type: mimeType });
}
