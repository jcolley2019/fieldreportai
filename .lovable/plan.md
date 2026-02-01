
# Stop Flashing & Update Text on AI Chat Button

## Summary
Remove the pulsing/flashing animation from the AI help menu button and label, and shorten the text from "Have Questions?" to "Questions?"

## Changes Required

### File: `src/components/LandingChatBot.tsx`

| Line | Current | Change To |
|------|---------|-----------|
| 213-215 | Label with `animate-pulse` class when `shouldPulse` | Remove the conditional `animate-pulse` class entirely |
| 217 | `"Have Questions?"` | `"Questions?"` |
| 226-228 | Button with `animate-pulse ring-4 ring-primary/30` when pulsing | Remove the conditional `animate-pulse ring-4 ring-primary/30` class |

### Detailed Changes

**1. Remove pulse animation from label (line 213-215):**
```tsx
// Before
className={`bg-card border border-border rounded-full px-4 py-2 shadow-lg transition-all duration-300 ${
  shouldPulse ? 'animate-pulse' : ''
}`}

// After
className="bg-card border border-border rounded-full px-4 py-2 shadow-lg transition-all duration-300"
```

**2. Update text (line 217):**
```tsx
// Before
<span className="text-sm font-medium text-foreground whitespace-nowrap">Have Questions?</span>

// After
<span className="text-sm font-medium text-foreground whitespace-nowrap">Questions?</span>
```

**3. Remove pulse animation from button (line 226-228):**
```tsx
// Before
className={`w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 flex items-center justify-center group hover:scale-105 ${
  shouldPulse && !isOpen ? 'animate-pulse ring-4 ring-primary/30' : ''
}`}

// After
className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 flex items-center justify-center group hover:scale-105"
```

## Result
- The AI chat button and label will no longer flash/pulse
- The label will display the shorter, cleaner text "Questions?"
- The button retains its hover effects (scale and color change) for interactivity
