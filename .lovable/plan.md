
## Remove Field Notes from Quick Capture Page

### What's Happening

The Field Notes textarea is already conditionally hidden in Quick Capture mode using `{!isQuickCapture && ...}` on line 1242 of `CaptureScreen.tsx`. However, the element still exists in the DOM (just not rendered). The user wants it fully removed — cleaning up the code so the field notes textarea is permanently gone from the Quick Capture capture page, with no conditional logic left behind.

### What Will Change

**File: `src/pages/CaptureScreen.tsx`**

- Remove lines 1241–1257: The entire `{/* Description Textarea — hidden in Quick Capture mode */}` block including the comment, label, `<Textarea>`, and character counter.
- The `{!isQuickCapture && ...}` wrapper and its contents are deleted outright.
- The rest of the page (Quick Actions grid, camera button, image gallery, Generate Report button) remains unchanged.

### Technical Notes

- The `description` state variable is still used in the Quick Capture generate flow (line 1442 checks `!description && activeImgs.length === 0`) and in `handleSaveProjectAndGenerate`. Removing the textarea from the UI means `description` will always be an empty string in Quick Capture mode — which is correct behavior since the project sheet auto-generates a description in that mode.
- No logic changes are needed — just the UI element removal.
- The `FileText` import from `lucide-react` is still used in the Quick Actions grid (Add Note button), so it does not need to be removed.
