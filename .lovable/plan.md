
## Add "Image Deleted" Status with Auto-Dismiss to Gallery Review

### What the User Wants
When viewing captured photos in the gallery review dialog, tapping a trash/delete icon on an individual photo should:
1. Immediately replace that photo's tile with a red "Image Deleted" placeholder (matching the screenshot — red background, trash icon, "Image Deleted" text, and an "Undo" button)
2. After **1 second**, automatically remove the tile permanently and clear the status
3. If the user taps "Undo" within that 1 second, the photo is restored to its original position

### Current Behavior
Individual photos can only be deleted via:
- Tap to select → bulk delete bar appears → tap Delete
- No per-photo trash icon, no "Image Deleted" feedback, no undo

### New Behavior

Each photo tile gets a **trash icon button** in a corner. Tapping it:
- Marks that index as "pending deletion" in a new state: `deletedItems: Map<index, timeoutId>`
- The tile at that index renders as a red placeholder instead of the photo
- A `setTimeout` of 1000ms fires — when it completes, the image is permanently removed from `capturedImages`
- If "Undo" is tapped before the timeout, `clearTimeout` is called and the tile restores normally

### Technical Changes

**File: `src/components/LiveCameraCapture.tsx`**

1. **Add new state** near the top of the component (around line 54):
   ```tsx
   const [deletingItems, setDeletingItems] = useState<Map<number, ReturnType<typeof setTimeout>>>(new Map());
   ```

2. **Add delete handler** function:
   ```tsx
   const handleDeletePhoto = (index: number) => {
     const timeoutId = setTimeout(() => {
       // Commit deletion: remove item, clear from deletingItems
       setCapturedImages(prev => prev.filter((_, i) => i !== index));
       setDeletingItems(prev => {
         const next = new Map(prev);
         next.delete(index);
         return next;
       });
     }, 1000);
     setDeletingItems(prev => new Map(prev).set(index, timeoutId));
     // Also deselect if it was selected
     setSelectedGalleryItems(prev => {
       const next = new Set(prev);
       next.delete(index);
       return next;
     });
   };
   ```

3. **Add undo handler**:
   ```tsx
   const handleUndoDelete = (index: number) => {
     setDeletingItems(prev => {
       const next = new Map(prev);
       const timeoutId = next.get(index);
       if (timeoutId !== undefined) clearTimeout(timeoutId);
       next.delete(index);
       return next;
     });
   };
   ```

4. **Update the grid tile rendering** (lines 1135–1180) so each tile either shows the photo (with a per-item trash icon) or the red "Image Deleted" placeholder:

   ```tsx
   {capturedImages.map((file, index) => {
     const isDeleting = deletingItems.has(index);
     const isSelected = selectedGalleryItems.has(index);

     if (isDeleting) {
       return (
         <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-red-500/80 flex flex-col items-center justify-center gap-1">
           <Trash2 className="h-5 w-5 text-white" />
           <span className="text-white text-xs font-semibold">Image Deleted</span>
           <button
             onClick={() => handleUndoDelete(index)}
             className="mt-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase tracking-wider"
           >
             Undo
           </button>
         </div>
       );
     }

     return (
       <div key={index} ...>
         <img ... />
         {/* Number badge */}
         {/* Per-item trash button */}
         <button
           onClick={(e) => { e.stopPropagation(); handleDeletePhoto(index); }}
           className="absolute bottom-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-all"
         >
           <Trash2 className="h-3.5 w-3.5" />
         </button>
         {/* Existing selection checkbox */}
       </div>
     );
   })}
   ```

5. **Cleanup on dialog close** — clear all pending timeouts when `showGalleryReview` closes:
   ```tsx
   onOpenChange={(open) => {
     if (!open) {
       // Clear all pending delete timeouts
       deletingItems.forEach(timeoutId => clearTimeout(timeoutId));
       setDeletingItems(new Map());
       setSelectedGalleryItems(new Set());
     }
     setShowGalleryReview(open);
   }}
   ```

### Index Stability Note
Since items are deleted by index but `capturedImages` indices shift on removal, the deletion must be careful. The `setTimeout` captures the original index, so after a deletion commits, the remaining `deletingItems` entries may reference stale indices. The safest approach: store deletion by **file identity** (the File object reference) rather than index, then filter by it.

Revised approach — store the **File object** itself as the pending deletion key:
```tsx
const [deletingFiles, setDeletingFiles] = useState<Map<File, ReturnType<typeof setTimeout>>>(new Map());
```
This avoids index-shift bugs entirely — each File reference is unique, regardless of array position.

### Files Changed
- `src/components/LiveCameraCapture.tsx` only
- No new dependencies needed
- No database changes
