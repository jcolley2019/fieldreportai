

# Fix: Image Previews Not Showing in Final Report

## Problem Identified

The Final Report page shows broken/blank image previews because it's using `getPublicUrl()` to fetch images from a **private storage bucket**. 

The `media` bucket has `public: false`, which means images can only be accessed via **signed URLs** (temporary, time-limited access tokens), not public URLs.

## Current Behavior

**FinalReport.tsx** (broken):
```typescript
const getMediaUrl = (filePath: string) => {
  const { data } = supabase.storage.from('media').getPublicUrl(filePath);
  return data.publicUrl;  // Returns a URL that requires authentication - won't work!
};
```

**ProjectDetail.tsx** (working correctly):
```typescript
const { data: signedUrlData } = await supabase.storage
  .from('media')
  .createSignedUrl(item.file_path, 3600); // Creates a temporary access URL
```

## Solution

Update FinalReport.tsx to generate signed URLs for media files, just like ProjectDetail.tsx does. This involves:

1. **Add state to store signed URLs** - Create a `mediaUrls` state object to cache the generated URLs
2. **Generate signed URLs when loading media** - After fetching media items, generate signed URLs for each image
3. **Update the display function** - Modify `getMediaUrl()` to look up URLs from the cached state
4. **Fix PDF and Word export functions** - These also use `getPublicUrl()` and need the same fix

---

## Technical Details

### Files to Modify

**1. src/pages/FinalReport.tsx**

- Add new state variable:
  ```typescript
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  ```

- Update the `useEffect` data loading to generate signed URLs after fetching media:
  ```typescript
  // After fetching media, generate signed URLs for private bucket
  const urls: Record<string, string> = {};
  for (const item of mediaData) {
    if (item.file_type === 'image') {
      const { data: signedUrlData } = await supabase.storage
        .from('media')
        .createSignedUrl(item.file_path, 3600); // 1 hour expiry
      if (signedUrlData?.signedUrl) {
        urls[item.id] = signedUrlData.signedUrl;
      }
    }
  }
  setMediaUrls(urls);
  ```

- Update `getMediaUrl` function to use cached signed URLs:
  ```typescript
  const getMediaUrl = (itemId: string) => {
    return mediaUrls[itemId] || '';
  };
  ```

- Update the image display JSX to pass `item.id` instead of `item.file_path`:
  ```typescript
  <img src={getMediaUrl(item.id)} alt="Project media" ... />
  ```

- Update `handleDownloadPDF` to use signed URLs for PDF generation
- Update `handleDownloadWord` to use signed URLs for Word document image embedding

**2. src/pages/Checklist.tsx** (also affected)

- Apply the same signed URL pattern for displaying images on the checklist page

### Why Signed URLs?

- The `media` bucket is intentionally private for security (user-uploaded photos shouldn't be publicly accessible)
- Signed URLs provide temporary access (1 hour) and expire automatically
- This is the recommended pattern already in use on ProjectDetail.tsx

