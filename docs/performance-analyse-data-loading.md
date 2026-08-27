# Y-app Performance Analyse: Data Loading

**Datum:** 2026-04-09
**Status:** Analyse compleet, nog niet geïmplementeerd

---

## Probleem

Vertraging bij doorklikken tussen pagina's. Elke navigatie haalt data opnieuw op.

## Root Cause

Geen client-side cache. Bij elke paginanavigatie:

1. React lazy-load — pagina-component wordt geladen (JS bundle chunk)
2. Component mount — `useEffect` triggert `loadData()`
3. Verse API calls — `fetchList()`/`fetchAll()` gaan elke keer naar de server
4. Server proxiet door naar ERPNext (200-500ms per call)
5. Component unmount bij navigatie = alle state weg

### Voorbeeld:
```
Klik "Verkoopfacturen" → 3 API calls → 600-1500ms
Klik "Projecten"        → 2 API calls → 400-1000ms
Klik terug "Verkoop"    → OPNIEUW 3 calls (alles weg!) → 600-1500ms
```

---

## Zwaarste pagina's (aantal fetch calls)

| Pagina | Fetch calls | Opmerking |
|--------|-------------|-----------|
| Employees.tsx | 12 | activity types, contract hours, leave, overuren |
| ErpNextOverview.tsx | 10 | veel doctypes tellen |
| Tasks.tsx | 10 | taken + subtaken + assignments |
| Subtasks.tsx | 9 | geneste taken |
| TeFactureren.tsx | 8 | timesheets + projects + employees |
| SalesInvoices.tsx | 7 | count + list + communications |
| BTW.tsx | 6 | meerdere account queries |
| Timesheets.tsx | 6 | list + detail fetches |
| Jaarrekening.tsx | 6 | P&L + balans queries |

---

## Voorgestelde fixes

### Hoge prioriteit (doorklik-probleem)

#### 1. Client-side request cache in `erpnext.ts` (~15 min)
Cache responses 30-60 seconden in een Map. Terugklikken = instant.

```typescript
// packages/frontend/src/lib/erpnext.ts
const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000; // 30s

export async function fetchList<T>(...) {
  const key = `${doctype}:${JSON.stringify(params)}`;
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T[];
  }
  // ... fetch ...
  responseCache.set(key, { data: result, ts: Date.now() });
  return result;
}
```

#### 2. Server-side Cache-Control headers (~10 min)
Stabiele data (Company, Employee, Project) krijgt `max-age=300`.

```typescript
// packages/server/src/index.ts
const stableDoctypes = ["Company", "Employee", "Project", "Activity Type"];
if (stableDoctypes.includes(doctype)) {
  res.set("Cache-Control", "public, max-age=300");
}
```

#### 3. Keep-alive page state (~20 min)
React context of state manager zodat pagina-data bewaard blijft bij navigatie.
Alternatief: `react-router` met `keepAlive` pattern of `useStickyState` hook.

#### 4. Prefetch bij hover (~10 min)
Start data-fetch wanneer gebruiker over sidebar-item hovert.

```typescript
// Sidebar.tsx
onMouseEnter={() => prefetchPageData(page.id)}
```

### Startup optimalisaties

#### 5. Parallelize auth flow (~5 min)
User + Roles fetch parallel i.p.v. sequentieel in `auth.ts`.

```typescript
const [userRes, rolesRes] = await Promise.all([
  fetch(`${targetUrl}/api/method/frappe.client.get?doctype=User&name=${usr}`, ...),
  fetch(`${targetUrl}/api/method/frappe.core.doctype.user.user.get_roles?uid=${usr}`, ...),
]);
```
Bespaart 600ms op eerste request.

#### 6. Parallelize fetchAll paginering (~15 min)
Eerste pagina ophalen, rest parallel.

```typescript
const first = await fetchList(doctype, { limit_start: 0 });
if (first.length < 500) return first;
const rest = await Promise.all(
  [1, 2, 3].map(p => fetchList(doctype, { limit_start: p * 500 }))
);
return [first, ...rest].flat();
```

#### 7. Verwijder overbodige fetchCount (~5 min)
`SalesInvoices.tsx` doet aparte count-call. Gebruik `list.length` of response metadata.

#### 8. Refresh interval 60s → 5min + visibility-based (~5 min)
DataContext refresht nu elke 60s, ook bij inactieve tab.

```typescript
const REFRESH_INTERVAL = 5 * 60_000;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshData();
});
```

### Lage prioriteit

#### 9. Request deduplicatie (~10 min)
Voorkom dubbele requests binnen 100ms (bijv. Task wordt door meerdere widgets opgehaald).

#### 10. Server-side proxy cache voor GET requests (~15 min)
Uitbreiding van bestaande `urenStatsCache` naar andere doctypes.

---

## Verwachte impact

| Situatie | Nu | Na fixes 1-4 |
|----------|-----|---------------|
| Eerste paginabezoek | 600-1500ms | 400-800ms |
| Terugklikken (binnen 30s) | 600-1500ms | **<50ms** (cache hit) |
| Hover + klik | 600-1500ms | **<200ms** (prefetch) |
| App startup (cold) | 1.2-3s | 0.6-1.5s |
