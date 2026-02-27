

## Problem

The last edit added `navigate("/auth", { replace: true })` inside the render body of `Index.tsx` (line 417). This is problematic because:

1. It calls `navigate()` during render, which is a React anti-pattern and can cause loops/crashes.
2. It duplicates the redirect logic that `ProtectedRoute` already handles — every protected route is wrapped in `<ProtectedRoute>`, which cleanly redirects unauthenticated users to `/auth`.
3. This is likely causing the spinner/redirect issues you are seeing.

The `ProtectedRoute` component already guarantees that `Index.tsx` will never render without an authenticated user. The `if (!user)` block in Index.tsx was originally a harmless fallback spinner for a brief race condition during session restoration — it should not navigate.

## Plan

### 1. Revert the navigate call in Index.tsx (lines 415-417)

Restore the original comment and remove the `navigate()` call:

```typescript
if (!user) {
  // Session not restored yet — show spinner (handles mobile refresh race condition)
  return (
    ...spinner...
  );
}
```

This is a single-line revert. `ProtectedRoute` handles all auth redirects, so Index.tsx does not need its own.

### 2. No other changes needed

- `ProtectedRoute` correctly redirects unauthenticated users to `/auth` with a redirect param.
- The auth page correctly redirects authenticated users to the dashboard.
- The landing page correctly redirects authenticated users to the dashboard.
- All protected routes are wrapped in `ProtectedRoute`.

To preview protected pages while logged out, you can log in via the preview's `/auth` page. The full auth flow (login, redirect, protected routes) will work as designed.

### Regression checklist
- **Auth**: No auth code changed; ProtectedRoute untouched.
- **Navigation**: Removing the erroneous navigate() restores stable behavior; ProtectedRoute still handles redirects.
- **Build**: Minimal diff — one line reverted.

