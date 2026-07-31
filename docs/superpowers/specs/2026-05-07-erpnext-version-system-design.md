# Per-Instance Frappe Version System — Design Spec

## Context

De Y-app ondersteunt meerdere ERPNext instances per gebruiker. Verschillende instances draaien verschillende Frappe versies (v15 en v16) met incompatibele API's. Voorbeeld: aggregate-count syntax verschilt — v15 accepteert `"count(name) as total"` als string, v16 vereist `{"COUNT": "*"}` dict syntax. Ad-hoc try/catch fallbacks in de frontend zijn rommelig en breken bij elke nieuwe v16 quirk.

Doel: versie-kennis op één plek (de server), bij toevoegen detecteren, in DB opslaan, abstracte endpoints voor de echte verschillen.

## Architectuur

**Server is single source of truth voor versie-kennis.** Bij `addInstance()` doet de server een call naar `/api/method/frappe.utils.change_log.get_versions`, parsed het major-versie nummer, en slaat het op. Faalt dat, dan kan de instance niet worden toegevoegd (hard fail). De frontend roept abstracte endpoints aan zonder versie-kennis.

**Override mogelijkheid** — gebruiker kan in Settings een handmatige override instellen als auto-detect verkeerd zit.

## Data model

Migration in `packages/server/src/db.ts`:

```sql
ALTER TABLE instances ADD COLUMN frappe_major_version INTEGER NOT NULL DEFAULT 15;
ALTER TABLE instances ADD COLUMN version_detected_at INTEGER;
ALTER TABLE instances ADD COLUMN version_override INTEGER;
```

- `frappe_major_version` — auto-detected major (15 of 16)
- `version_detected_at` — timestamp van detectie (voor "laatst gecontroleerd" UI)
- `version_override` — NULL of handmatige override (15 of 16). Effective = override ?? detected.

## Server: `erpnext-version.ts` (nieuw)

```typescript
// Single source of truth for version logic
export async function detectFrappeVersion(url: string, sid: string): Promise<number>
  // Calls /api/method/frappe.utils.change_log.get_versions
  // Parses message.frappe.version (e.g. "15.105.0") → 15
  // Throws if call fails or version not parseable

export function getEffectiveVersion(instanceId: number): number
  // Reads instances row, returns version_override ?? frappe_major_version

export function refreshDetectedVersion(instanceId: number, sid: string): Promise<number>
  // Re-runs detection, updates frappe_major_version + version_detected_at
```

## Server endpoints

### Existing — modify

**`POST /api/instances`** (in `instances.ts:addInstance`):
- Na het verkrijgen van de ERPNext sid via `loginToErpNext`, call `detectFrappeVersion(url, sid)`
- Save `frappe_major_version` + `version_detected_at`
- If detection throws → return 400 `{ error: "Could not detect Frappe version" }`

**`POST /api/instances/test-connection`** (in `instances.ts`):
- Same — also detect and return the version in the response so the UI can preview before saving

### New routes

**`GET /api/i/:id/count?doctype=X&filters=[...]`** → `{ count: number }`
- Reads effective version
- v15: `frappe.client.get_count` via proxy
- v16: REST aggregate met dict syntax: `GET /api/resource/X?fields=[{"COUNT":"*"}]`
- Universal fallback: parses response uniformly, returns `{ count }`

**`POST /api/instances/:id/refresh-version`** (in `instances.ts`):
- Re-runs detection, updates DB, returns new version

**`PUT /api/instances/:id/version-override`** body `{ version: 15 | 16 | null }`:
- Sets/clears version_override

## Frontend impact

### `packages/frontend/src/lib/erpnext.ts`

Rewrite `fetchCount()`:
```typescript
export async function fetchCount(doctype: string, filters?: unknown[][]): Promise<number> {
  const instanceId = getActiveInstanceId();
  const params = new URLSearchParams({ doctype });
  if (filters) params.set("filters", JSON.stringify(filters));
  const res = await fetch(`/api/i/${instanceId}/count?${params}`, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, `count failed: ${res.status}`);
  const json = await res.json();
  return json.count;
}
```

No version awareness on the frontend. All count calls go through one endpoint.

### `packages/frontend/src/components/InstancesPage.tsx`

In each instance card, show the detected version as a small badge:
```
Frappe v15 (gedetecteerd 2026-05-07)
```
If `version_override` is set: show "v15 (override van v16)" with an asterisk.

### Instance edit form (in InstancesPage modal)

Add a "Frappe versie" sectie:
- Read-only: gedetecteerde versie + datum
- Checkbox: "Handmatig overschrijven"
- If checked: dropdown v15/v16
- Knop: "Opnieuw detecteren" → call `refresh-version`

## Compatibility surface

| API concept | v15 | v16 | Server route |
|---|---|---|---|
| Count | `frappe.client.get_count` | `fields=[{"COUNT":"*"}]` | `/api/i/:id/count` |
| List | `/api/resource/X?fields=[...]` | identical | existing proxy `/api/i/:id/resource/X` |
| Get | `/api/resource/X/<name>` | identical | existing proxy |
| Method call | `/api/method/<name>` | identical (per-method whitelist may differ) | existing proxy |
| Custom fields | per-instance configuration | per-instance configuration | not version-related |

Custom field availability (e.g. `custom_description` on Quotation) is **per-instance configuratie**, niet versie-gerelateerd. Blijft via try/catch in pages waar het optioneel is.

## File list

| File | Action | Responsibility |
|---|---|---|
| `packages/server/src/db.ts` | Modify | Schema migration (3 columns) |
| `packages/server/src/erpnext-version.ts` | Create | Detection + effective-version logic |
| `packages/server/src/instances.ts` | Modify | Detect on addInstance, refresh + override functions |
| `packages/server/src/index.ts` | Modify | `GET /api/i/:id/count`, `POST .../refresh-version`, `PUT .../version-override` |
| `packages/frontend/src/lib/erpnext.ts` | Modify | `fetchCount` uses new endpoint |
| `packages/frontend/src/components/InstancesPage.tsx` | Modify | Show version badge + override UI |

## Verification

1. Add a v16 instance (Domera): server detects "16", saves it
2. Add a v15 instance (3BM): server detects "15", saves it
3. Frontend `fetchCount("Project")` on Domera returns correct count (uses v16 syntax)
4. Frontend `fetchCount("Project")` on 3BM returns correct count (uses v15 syntax)
5. UI shows version badge per instance
6. Override v15 → v16 in settings, fetchCount switches behavior immediately
7. Try to add unreachable instance → 400 error, not added
