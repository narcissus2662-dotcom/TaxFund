# CLAUDE.md

Project context for Claude Code. Read this before editing.

## What this is
A personal **Thai tax-saving-fund purchase tracker** — a single-file web app (PWA) that logs
fund purchases, shows progress toward an annual target as a donut chart, and tells the user how
much to buy each week to hit the target by **30 November**. UI language is **Thai**.

## Structure
- **`index.html`** — the entire app. Self-contained: HTML + CSS + vanilla JS in one file.
  There is **no build step**, no framework, no bundler, no dependencies.
- **`CLAUDE.md`** — this file.

Keep it a single file. Do not introduce a build system, npm packages, or split files unless
explicitly asked — the whole point is drag-to-deploy simplicity.

## Deploy
Hosted on **Netlify**, connected to this **GitHub** repo.
Pushing to the default branch triggers an automatic Netlify redeploy. So: edit → commit → push,
and the live site updates on its own. No manual upload needed.

## Data storage (dual-mode, same file works in both places)
- The app calls `window.storage` if present (Claude.ai artifact runtime), otherwise falls back to
  `localStorage` (deployed site). See `loadData()` / `saveData()`.
- Local data key: **`taxfund:data`** — JSON `{ target, purchases[], customFunds[], updatedAt }`.
- Do NOT hard-require `localStorage` at top level (it throws in the Claude artifact sandbox) — the
  guarded fallback pattern must stay.

## Optional cloud sync (Supabase)
- Lets the user sync across devices. Config stored locally under key **`taxfund:sync`**
  (`{ url, key, code, on }`), entered via the ☁ button in the header.
- Uses Supabase REST directly (no SDK): `POST /rest/v1/trackers?on_conflict=code` with header
  `Prefer: resolution=merge-duplicates` to upsert; `GET /rest/v1/trackers?code=eq.<code>` to pull.
- Auth: the key always goes in the `apikey` header. `sbHeaders()` adds `Authorization: Bearer` **only**
  for legacy JWT anon keys (those starting `eyJ`) — a `sb_publishable_…` key does not get that header.
- Table `public.trackers (code text pk, data jsonb, updated_at timestamptz)` with RLS + anon
  policies. Conflict strategy: **last-write-wins** by `updatedAt`.
- `code` is a secret (like a password). Never log it or expose it.

## Key logic
- **Donut**: drawn with SVG `<circle>` stroke-dasharray segments (`#segs` group), one per fund plus
  a remainder arc. Center shows overall %.
- **Weekly pace**: `remaining / weeksToDeadline()`, where the deadline is 30 Nov of the current year.
- **Fund chips**: presets `["RMF","SSF","Thai ESG","Thai ESGX"]` plus user-typed funds, which persist
  in `customFunds` and render with a delete ✕.
- **PWA**: manifest + icon are generated at runtime (`setupPWA()` / `makeIcon()` via canvas) so the
  app stays a single file.

## Conventions / guardrails
- **Font**: Kanit (Google Fonts) — supports Thai + Latin, used at weights up to 800.
- **Palette**: cobalt `#3B4CF0`, coral `#FF5C4D`, lemon `#FFD23F`, mint `#14C48B`, bubble `#FF8CC6`,
  violet `#8B5CF6`; bg cream `#FBF4E9`, ink text `#16130F`.
- **Accessibility**: all text/background pairs currently pass **WCAG AA** (≥4.5:1 normal, ≥3:1 large).
  If you change any color, re-check contrast before committing. Rule of thumb: dark ink text on the
  bright color blocks, not light-on-light.
- Keep element **IDs and class names stable** — the JS wires everything by ID.
- Keep UI copy in **Thai**.
- After changing `state`, always call **`persist()`** (it stamps `updatedAt` and schedules the cloud
  push), never `saveData()` / `saveLocalOnly()` directly — otherwise the change never syncs.
- If you change the shape of `state`, update **`normalize()`** too, or older synced data breaks.
- Month indexes in JS are 0-based: the 30 Nov deadline is `new Date(year, 10, 30)`.
- Sanity-check after editing (see below).

## Handy commands
```bash
# quick JS syntax check on the inline script (Node is NOT installed on this Mac —
# use the built-in JavaScriptCore instead; new Function() parses without executing)
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/app.js && \
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
  -e 'new Function(readFile("/tmp/app.js")); print("JS OK")'

git add -A && git commit -m "..." && git push   # → Netlify auto-deploys
```
