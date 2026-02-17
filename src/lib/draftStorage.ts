/**
 * Draft storage utility using IndexedDB to persist captured photos
 * across page refreshes so work is never lost.
 */

const DB_NAME = "fieldreport-drafts";
const DB_VERSION = 1;
const STORE_NAME = "capture-drafts";
const DRAFT_KEY = "current-draft";

interface DraftImage {
  id: string;
  base64: string;
  originalBase64?: string | null;
  caption?: string;
  voiceNote?: string;
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
  locationName?: string;
  isVideo?: boolean;
  deleted: boolean;
}

export interface DraftData {
  images: DraftImage[];
  description: string;
  reportId?: string;
  savedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(data: DraftData): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, DRAFT_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("Failed to save draft:", err);
  }
}

export async function loadDraft(): Promise<DraftData | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
    const result = await new Promise<DraftData | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.error("Failed to load draft:", err);
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("Failed to clear draft:", err);
  }
}

/**
 * Convert a File to a base64 data URL for draft storage.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a base64 data URL back to a File object.
 */
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new File([u8arr], filename, { type: mime });
}
