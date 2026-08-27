# Email Instance Isolation Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix email credential leaking between ERPNext instances — each instance gets its own isolated mail credentials (3BM = Office365 via ERPNext auto-config, Impertio = manual IMAP).

**Architecture:** The root cause is that `/api/mail/*` routes are registered in Express before the auth middleware selector, so `authMiddleware` never runs and `req.instanceId` is never set. The mail session cache then stores all instances under the same key (`sid:undefined`). The fix: add a lightweight middleware to all mail routes that extracts instanceId from the `X-Y-App-Instance` header and optionally resolves the ERPNext session.

**Tech Stack:** Express middleware, ImapFlow, existing Y-app auth system

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/server/src/index.ts` | Modify | Move mail routes AFTER auth middleware selector, OR add mail-specific middleware |
| `packages/server/src/mail.ts` | Modify | Ensure `getCredentials` properly uses instanceId |
| `packages/frontend/src/pages/Webmail.tsx` | Verify | Confirm X-Y-App-Instance header is sent (it is, via fetch interceptor) |

---

### Task 1: Add mail auth middleware that sets instanceId

**Files:**
- Modify: `packages/server/src/index.ts:497-509` (middleware selector)
- Modify: `packages/server/src/index.ts:915-938` (mail route registration)

The simplest fix: move all `/api/mail/*` routes to AFTER the middleware selector block, so they pass through `authMiddleware` and get `req.instanceId` + `req.erpnextSid` set correctly.

- [ ] **Step 1: Move mail route registration after the middleware selector**

In `packages/server/src/index.ts`, find the auth middleware selector (around line 497):

```typescript
// Current: mail routes are at line 915, BEFORE the middleware selector applies
// The middleware selector is defined around line 497 via app.use()
```

The fix: ensure `/api/mail/*` is NOT in the exclusion list (it already isn't — verified). The real problem is that Express route matching happens at registration time. Routes registered with `app.get/post` are matched before `app.use` middleware.

Instead, wrap all mail routes with the existing `authMiddleware`:

In `packages/server/src/index.ts`, change the mail route block from:

```typescript
app.post("/api/mail/test", mailTestConnection);
app.post("/api/mail/test-shared", mailTestShared);
app.post("/api/mail/config", mailSetConfig);
// ... etc
```

To:

```typescript
app.post("/api/mail/test", authMiddleware, mailTestConnection);
app.post("/api/mail/test-shared", authMiddleware, mailTestShared);
app.post("/api/mail/config", authMiddleware, mailSetConfig);
app.delete("/api/mail/config", authMiddleware, mailClearConfig);
app.get("/api/mail/folders", authMiddleware, mailListFolders);
app.get("/api/mail/messages", authMiddleware, mailListMessages);
app.get("/api/mail/message", authMiddleware, mailGetMessage);
app.get("/api/mail/attachment", authMiddleware, mailGetAttachment);
app.post("/api/mail/send", authMiddleware, mailSend);
app.delete("/api/mail/message", authMiddleware, mailDeleteMessage);
app.post("/api/mail/move", authMiddleware, mailMoveMessage);
app.post("/api/mail/folder", authMiddleware, mailCreateFolder);
app.post("/api/mail/warmup", authMiddleware, mailWarmup);
app.get("/api/mail/warmup", authMiddleware, mailWarmup);
app.get("/api/mail/cache-stats", authMiddleware, mailCacheStats);
app.post("/api/mail/mark-read", authMiddleware, mailMarkRead);
app.post("/api/mail/mark-unread", authMiddleware, mailMarkUnread);
app.post("/api/mail/rename-folder", authMiddleware, mailRenameFolder);
app.get("/api/mail/auto-config", authMiddleware, mailAutoConfig);
app.get("/api/mail/warm", authMiddleware, mailIsWarm);
app.get("/api/mail/contacts", authMiddleware, mailListContacts);
app.get("/api/mail/signature", authMiddleware, mailGetSignature);
app.get("/api/mail/conversation", authMiddleware, mailGetConversation);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "fix: add authMiddleware to all mail routes for instance isolation"
```

---

### Task 2: Clear stale mail session cache on instance switch

**Files:**
- Modify: `packages/frontend/src/pages/Webmail.tsx` (around line 3078, the showSetup logic)
- Modify: `packages/frontend/src/lib/webmail-prefetch.ts` (ensureMailConfigPushed)

When the user switches instances, the cached mail config from the previous instance may still be served. The frontend already stores config per-instance in localStorage — the fix ensures the server-side cache is also refreshed.

- [ ] **Step 1: Force re-push of mail config when Webmail mounts**

In `packages/frontend/src/lib/webmail-prefetch.ts`, find `ensureMailConfigPushed()`. It currently skips if already pushed. Add the active instance ID to the "already pushed" check so switching instances forces a re-push:

```typescript
// Current: pushed flag is global
let mailConfigPushed = false;

// Fix: track which instance was pushed
let mailConfigPushedForInstance: string | null = null;

export async function ensureMailConfigPushed(config: ImapConfig, acct?: string): Promise<void> {
  const currentInstance = getActiveInstanceId();
  if (mailConfigPushedForInstance === currentInstance && !acct) return;
  // ... existing push logic ...
  mailConfigPushedForInstance = currentInstance;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/webmail-prefetch.ts
git commit -m "fix: re-push mail config when switching ERPNext instances"
```

---

### Task 3: Fix TLS for mail.impertio.nl

**Files:**
- Verify: `packages/server/src/mail.ts` (TLS config, already partially fixed)

The `rejectUnauthorized: false` fix was already applied. Verify it's in both locations (AccountCache constructor and test connection function).

- [ ] **Step 1: Verify TLS settings in mail.ts**

Confirm both ImapFlow instantiation points use:
```typescript
tls: {
  servername: creds.host,
  rejectUnauthorized: false,
},
```

- [ ] **Step 2: Test with mail.impertio.nl**

After backend restart, test connection:
```bash
curl -s -X POST http://localhost:3500/api/mail/test \
  -H "Content-Type: application/json" \
  -H "Cookie: y_app_session=<session>" \
  -H "X-Y-App-Instance: 3" \
  -d '{"host":"mail.impertio.nl","port":993,"user":"<email>","pass":"<pass>","secure":true}'
```

If TLS still fails, try `secure: false` (STARTTLS on port 993).

- [ ] **Step 3: Commit if changes needed**

```bash
git add packages/server/src/mail.ts
git commit -m "fix: relax TLS validation for non-standard mail servers"
```

---

## Verification

1. **TypeScript compilation**: `cd packages/frontend && npx tsc --noEmit` + `cd packages/server && npx tsc --noEmit`
2. **Restart backend** after changes to server code
3. **Test 3BM instance**: Go to Webmail → "Laden uit ERPNext" → should load Office365 OAuth2 config → emails load
4. **Switch to Impertio instance**: Go to Webmail → manually enter mail.impertio.nl credentials → "Test verbinding" → should connect without TLS error
5. **Switch back to 3BM**: Webmail should still show 3BM emails, NOT Impertio's
6. **Key check**: In browser dev tools, verify `X-Y-App-Instance` header changes when switching instances on `/api/mail/*` calls
