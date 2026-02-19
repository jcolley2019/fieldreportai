
## Root Cause Analysis

The timeout is caused by two compounding problems happening **sequentially** on the client side before the AI even starts:

**Problem 1 — Sequential image processing (the main culprit)**
The `generateSummary` function loops through ALL images one-by-one using `Promise.all`, but each image goes through:
1. Canvas-based compression (CPU-heavy, ~1-3 seconds per photo)
2. FileReader base64 encoding of the COMPRESSED version (for AI)
3. FileReader base64 encoding of the ORIGINAL version (for display)
4. FileReader base64 encoding of the ANNOTATED original (if applicable)

With 25 photos, this alone takes **30-60+ seconds** just to prepare the payload — before sending anything to the AI.

**Problem 2 — Sending 25 full base64 images in a single HTTP request**
Even at 512px/60% quality, 25 JPEG images average ~40-60KB each as base64, creating a payload of **1-1.5MB** that must fully serialize, transmit, and be processed by the edge function — which then streams it all to Gemini.

**The 90-second timeout fires before the AI even gets to work.**

---

## The Fix: Pre-upload Images to Storage, Send URLs Instead

The solution is to **upload photos to storage first** (which can be done at capture time or progressively), then send **storage URLs** to the edge function instead of raw base64 data. The edge function then passes those URLs directly to the Gemini API, which fetches them natively.

This transforms the flow from:
```
[Compress 25 photos] → [Encode to base64] → [Pack into 1MB+ payload] → [Send to Edge Fn] → [Edge Fn sends to Gemini]
```
To:
```
[Upload photos to storage as captured] → [Send 25 short URLs] → [Edge Fn sends URLs] → [Gemini fetches images directly]
```

---

## Implementation Plan

### 1. Pre-upload images to storage as they're captured
In `CaptureScreen.tsx`, after a photo is captured/added (in `handleImageUpload` and `handleLiveCameraCapture`), immediately compress and upload it to the `media` Supabase storage bucket. Store the resulting storage path on the image item as `storagePath`.

- Compression still happens at 512px/60% for the AI copy
- Upload runs **in the background** while the user continues capturing
- A small upload indicator per thumbnail (spinner → checkmark) shows status
- If upload fails, fall back to base64 (current behavior)

### 2. Modify `generateSummary` to send storage URLs
Instead of encoding everything to base64 at generation time:
- For images that were pre-uploaded: generate a **signed URL** (60-minute expiry) and send that to the edge function
- For any image not yet uploaded (e.g., just added): do the base64 fallback for that single image only
- Skip videos from the image URL list (keep voice note text context as-is)

### 3. Update the edge function to accept storage URLs
The edge function already accepts `imageDataUrls` — Gemini's `image_url` type works with both base64 data URIs **and** https:// URLs. No schema change needed, just ensure HTTPS URLs pass through correctly.

### 4. Separate the base64 encoding for display vs AI
Currently the code encodes the **original** image to base64 for display navigation (passed to `ReviewSummary`). This encoding should still happen but only for display — it should NOT block the AI call.

---

## Key Files to Change

| File | Change |
|---|---|
| `src/pages/CaptureScreen.tsx` | Add background upload on capture; modify `generateSummary` to use signed URLs |
| `src/lib/imageCompression.ts` | No changes needed |
| `supabase/functions/generate-report-summary/index.ts` | No changes needed (already supports image_url with https) |

---

## Expected Result

- **Before**: Client spends 30-60s compressing + encoding, then times out
- **After**: Images upload progressively as user captures them; `generateSummary` just gathers URLs (< 1 second), sends a tiny payload to the edge function, and the AI responds in **5-15 seconds**

This is the same pattern used by Google Photos, Dropbox, and other photo-processing apps — pre-upload assets, then reference by URL.

---

## Technical Details

**Storage path convention** (private, auth-scoped):
```
media/{user_id}/ai-thumbnails/{image_id}.jpg
```

**Signed URL generation** (in generateSummary, before calling the edge function):
```typescript
const { data: signedUrlData } = await supabase.storage
  .from('media')
  .createSignedUrl(img.storagePath, 3600); // 1-hour expiry
```

**Upload trigger** (immediately after push to images state):
```typescript
// Fire-and-forget background upload
uploadImageForAI(newImage).then(storagePath => {
  setImages(prev => prev.map(i => i.id === newImage.id ? { ...i, storagePath } : i));
});
```

**Fallback safety**: If `storagePath` is absent for any image at generation time, the existing base64 path runs for that single image only — no regression.
