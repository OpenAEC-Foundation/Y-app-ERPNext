# Webmail Mobile Responsive Design

## Goal
Make `packages/frontend/src/pages/Webmail.tsx` work on mobile screens (375px+) for the Android Tauri app, using a single-pane stack layout with back navigation. Desktop layout stays unchanged.

## Breakpoint
- Mobile: `< 768px` (below Tailwind `md:`)
- Detect via a `useIsMobile()` hook using `window.matchMedia("(max-width: 767px)")`

## Mobile Pane States

A state variable `mobilePane: "list" | "message" | "compose"` controls which pane is visible on mobile. Only one pane shows at a time.

### "list" (default)
- **Folder selector**: horizontal strip or dropdown at top showing current folder + unread count. Tap to switch folders. Not the full tree sidebar.
- **Message list**: full-width, same items as desktop but reflowed for narrow screens.
  - Each row: sender name (full width, bold if unread), subject below, date right-aligned on the sender line.
  - Attachment icon, flagged icon inline.
  - Touch target: full row height min 56px.
- **Toolbar**: simplified — compose (prominent), refresh, search toggle.
- **Tap a message** → sets `mobilePane = "message"` + `selectedUid`.

### "message"
- **Header bar**: back arrow (→ `mobilePane = "list"`), subject truncated.
- **Full-screen message**: from, to, date, body (html or text), attachments.
- **Bottom toolbar**: Reply, Reply All, Forward, Delete, Move — large touch targets (min 44px).
- **Conversation thread**: shown inline below the message (same as desktop).

### "compose"
- **Full-screen**: `fixed inset-0 z-50` on mobile.
- **Header**: Cancel (left), Send (right).
- **Fields**: To, CC (toggle), BCC (toggle), Subject, body (auto-grow textarea or contenteditable), attachments.
- **On desktop**: existing floating draggable window behavior unchanged — gate on `isMobile`.

## Desktop: Unchanged

All existing 3-pane layout logic is preserved. Changes are additive:
- Wrap desktop-only elements in `hidden md:flex` or `{!isMobile && ...}`.
- Mobile-only elements use `md:hidden`.
- No structural changes to desktop rendering paths.

## CSS Strategy

### Folder sidebar
```
Desktop: flex, width from state (folderWidth)
Mobile:  hidden (replaced by folder dropdown in message list toolbar)
```

### Message list
```
Desktop: width from state (listWidth), side-by-side with reading pane
Mobile:  w-full, shown only when mobilePane === "list"
```

### Reading pane
```
Desktop: flex-1, side-by-side with message list
Mobile:  fixed inset-0 z-40, shown only when mobilePane === "message"
```

### Compose window
```
Desktop: absolute positioned floating window (existing behavior)
Mobile:  fixed inset-0 z-50 flex flex-col
```

### Toolbar
```
Desktop: horizontal bar with text labels (existing)
Mobile:  icons only, flex-wrap, min-h-[44px] per button
```

### Dropdowns and modals
All fixed-width dropdowns get `max-w-[90vw]` added.

## Implementation Approach

Since Webmail.tsx is 3,700 lines, the changes should be surgical — add mobile conditionals without restructuring the existing desktop code. Key pattern:

```tsx
const isMobile = useIsMobile();
const [mobilePane, setMobilePane] = useState<"list" | "message" | "compose">("list");

// In message click handler, add:
if (isMobile) setMobilePane("message");

// In compose handler, add:
if (isMobile) setMobilePane("compose");

// In render, wrap sections:
{(!isMobile || mobilePane === "list") && <MessageList ... />}
{(!isMobile || mobilePane === "message") && <ReadingPane ... />}
```

## Folder Selector (Mobile)

Replace the full tree sidebar with a compact folder dropdown:
```tsx
<select value={activeFolder} onChange={e => switchFolder(e.target.value)}>
  {folders.map(f => <option key={f.path} value={f.path}>{f.name} ({f.unseen || 0})</option>)}
</select>
```
Or a horizontal scrollable chip strip for common folders (INBOX, Sent, Drafts, Trash) with a "More" button.

## Touch Targets

All buttons and interactive elements on mobile: `min-h-[44px] min-w-[44px]`.
Message list rows: min-height 56px with adequate padding.

## Back Navigation

Android hardware back button / swipe-back should work naturally:
- In "message" pane: back → "list"
- In "compose" pane: back → "list" (with unsaved draft warning if content exists)

This can be handled via `useEffect` listening to `popstate` or Tauri's back navigation event.

## Files to Modify

1. `packages/frontend/src/pages/Webmail.tsx` — all mobile layout changes
2. `packages/frontend/src/hooks/useIsMobile.ts` — new hook (or inline in Webmail)

No i18n changes needed — reuses existing translation keys.
