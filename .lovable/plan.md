
## Simplify Photo Deletion — Immediate Remove, No Placeholder

### What the User Wants
Tapping the trash icon on a photo in the gallery should **immediately delete it** — no "Image Deleted" tile, no Undo button, no timeout. Just gone.

### What to Remove / Change

**File: `src/components/LiveCameraCapture.tsx`**

1. **Remove `deletingFiles` state** (line 55):
   ```tsx
   // DELETE this line:
   const [deletingFiles, setDeletingFiles] = useState<Map<File, ReturnType<typeof setTimeout>>>(new Map());
   ```

2. **Replace `handleDeletePhoto`** (lines 418–440) — remove the timeout/Map logic, replace with a direct filter:
   ```tsx
   const handleDeletePhoto = (file: File) => {
     setCapturedImages(prev => prev.filter(f => f !== file));
   };
   ```

3. **Remove `handleUndoDelete`** entirely (lines 442–450).

4. **Remove the `isDeleting` placeholder branch** from the grid (lines 1176–1192) — the `if (isDeleting)` block that renders the red tile.

5. **Clean up the dialog `onOpenChange`** — remove the lines that clear `deletingFiles` timeouts since the state no longer exists:
   ```tsx
   // REMOVE these lines:
   deletingFiles.forEach(timeoutId => clearTimeout(timeoutId));
   setDeletingFiles(new Map());
   ```
   Keep only `setSelectedGalleryItems(new Set())` and `setShowGalleryReview(open)`.

### Files Changed
- `src/components/LiveCameraCapture.tsx` only — 5 small targeted removals
- No new dependencies, no database changes

### Potential Regressions
- Bulk delete (select + Delete button) is untouched
- "Delete All Photos" button is untouched
- Selection checkboxes are untouched
- The trash icon button on each tile remains, just with simpler logic
