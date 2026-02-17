
## Combine DONE Button with Photo Preview/Count

### What the user wants
Instead of the Done button and the gallery thumbnail being two separate stacked elements, they should be a single unified button that:
- **Before any photos are taken**: Shows a camera/photo icon inside a `h-14 w-14` rounded button (same size as the current Done button), with "Done" label below
- **After photos are taken**: The button transforms to show the last photo thumbnail as the background/fill, with the photo count badge in the corner, and tapping it triggers `handleDone` (exits and saves). The "Done" label stays below.

This removes the stacking/shifting behavior and makes it one clean, consistent control.

### Current Structure (problem)
In all three layout branches (photo mode, video idle, video recording), the left column has:
```
[Check icon button]  ← h-14 w-14
"Done" label
[Thumbnail button]   ← h-10 w-10, only appears after photos taken
 (count badge)
```

### Proposed Structure (solution)
Replace all three left-column blocks with a single unified button:
```
[Combined button]   ← always h-14 w-14, always visible
  - No photos: Camera icon (Image/Camera icon from lucide)
  - Has photos: Last photo as background fill + count badge overlay
"Done" label        ← always below
```

The combined button always calls `handleDone` on click (exits and saves). When there are photos, tapping it exits (which is the primary action). The gallery review (opening the full gallery) is a secondary action that can remain accessible via the thumbnail itself - but since we're combining them, clicking the combined button will just trigger `handleDone`. If the user wants to review photos before exiting, they can still do so via the existing gallery mechanisms.

### Technical Changes

**File: `src/components/LiveCameraCapture.tsx`**

Replace the left-column `div` in all three layout branches. Currently each branch has ~20 lines of two separate elements. They'll be replaced with a single ~15 line block:

```tsx
{/* Left: Combined Done/Gallery button */}
<div className="flex justify-center">
  <div className="flex flex-col items-center gap-1">
    <button
      onClick={handleDone}
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all overflow-hidden"
    >
      {capturedImages.length > 0 ? (
        <>
          <img
            src={URL.createObjectURL(capturedImages[capturedImages.length - 1])}
            alt="Gallery"
            className="w-full h-full object-cover"
          />
          {/* Count badge */}
          <div className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
            {capturedImages.length}
          </div>
        </>
      ) : (
        <ImageIcon className="h-6 w-6 text-white" />
      )}
    </button>
    <span className="text-xs font-semibold uppercase tracking-wider text-white">Done</span>
  </div>
</div>
```

This same block replaces the left column in all three branches:
1. Photo mode (line ~970)
2. Video idle / not recording (line ~925)
3. Video recording (line ~845)

The `Image` icon (or `ImageIcon`) from `lucide-react` will be used as the placeholder state.

### Benefits
- Clean, consistent button size at all times — no layout shift
- Intuitive: the button shows what you've captured, tapping it exits with your photos
- Removes the stacking behavior that caused the Done button to "move up"
- Matches native camera app UX patterns (like iOS camera)
