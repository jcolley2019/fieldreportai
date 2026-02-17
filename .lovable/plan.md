
## Fix Photo Count Badge Position — Photo Mode Branch

### The Problem
There are three camera mode branches, each with a left-column "Done" button:

1. **Video recording** (line ~848) — Badge is correctly outside the button, on a wrapper `div`
2. **Video idle** (line ~926) — Badge is correctly outside the button, on a wrapper `div`
3. **Photo mode** (line ~968) — Badge is still INSIDE the button using `absolute top-0 right-0`, but the button has `overflow-hidden` which clips the badge so it can't fully escape the button boundary

This is why the count appears partially inside the circle — the `overflow-hidden` on the button clips the absolutely-positioned badge.

### The Fix

**File: `src/components/LiveCameraCapture.tsx`** — Photo mode branch only (lines ~966–984)

Refactor the photo mode left-column to match the video branches exactly: wrap the button in a `relative` div, move the count badge onto that wrapper div positioned at `-top-1.5 -right-1.5`, and remove `relative` and `overflow-hidden` from the button itself (the button still needs `overflow-hidden` for the thumbnail image to fill it correctly, so keep that — but move the badge out).

Current structure (photo mode):
```
<button className="relative ... overflow-hidden">
  <img ... />                          ← thumbnail fills button
  <div className="absolute top-0 right-0 ...">3</div>  ← CLIPPED by overflow-hidden
</button>
```

New structure (matching video branches):
```
<div className="relative">             ← wrapper owns the positioning context
  <button className="... overflow-hidden">
    <img ... />                        ← thumbnail still fills button
  </button>
  <div className="absolute -top-1.5 -right-1.5 ...">3</div>  ← fully outside button
</div>
```

### Technical Details

- Only the photo mode branch (lines 966–985) needs to change
- Video recording and video idle branches are already correct
- The badge uses `absolute -top-1.5 -right-1.5` to sit in the top-right corner, partially overlapping the button edge but fully outside its `overflow-hidden` boundary
- No other files are touched
- No logic changes — purely a layout/positioning fix
