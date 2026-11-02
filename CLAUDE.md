# CLAUDE.md

Project context for Claude Code. Read this before editing.

## What this is
A personal **Thai tax-saving-fund purchase tracker**. It logs fund purchases, shows progress toward an
annual target as a donut chart, and tells the user how much to buy each week to hit the target by
**30 November**. UI language is **Thai**.

Since 2 Nov 2026 the real data lives in a **Google Sheet** and the app is a **Google Apps Script web app**
bound to that Sheet. Before that, data lived only in the phone browser's localStorage and was lost when
Chrome site data was cleared. Design: `docs/superpowers/specs/2026-11-02-sheet-storage-design.md`.

## Structure
- **`apps-script/Code.gs`** — server side: `doGet()` and the functions the page calls through
  `google.script.run` (`getData`, `addPurchase`, `deletePurchase`, `setTarget`, `setCustomFunds`).
- **`apps-script/Index.html`** — the whole app page (HTML + CSS + vanilla JS, no build step).
  The block between `/* PURE-START */` and `/* PURE-END */` holds logic that must not touch the DOM
  or `google.script.run`, so it can be tested with JavaScriptCore.
- **`apps-script/DEPLOY.md`** — Thai step-by-step guide for pasting the code into Apps Script and deploying.
- **`tests/`** — `run.sh` runs `server.test.js` (Code.gs against a fake Sheet in `fakes.js`) and
  `client.test.js` (the PURE block).
- **`index.html`** — the old Netlify link, now only a "the app has moved" page with a button to the
  Apps Script URL. It must never store data again.
- **`tax-fund-tracker.jsx`** — the first React prototype, kept for history only.

## Data
- Sheet tab **`Purchases`**: row 1 header `id | date | fund | amount | createdAt`. `date` is plain text
  `YYYY-MM-DD` (column B is formatted as text; `getData` also converts Date cells defensively).
  `id` comes from the app (`Date.now()`) so a retried add is never duplicated.
- Sheet tab **`Settings`**: `A1 target / B1 number`, `A2 customFunds / B2 JSON string`.
- Every write holds `LockService.getScriptLock()`.
- The page keeps two localStorage keys, both disposable: `taxfund:cache` (last data from the Sheet,
  for a fast first paint) and `taxfund:queue` (changes not yet confirmed by the Sheet).
- A change leaves the queue only after the server call succeeds. Each op is marked `sent` before its
  call, so deleting an add that may already be in the Sheet queues a delete instead of cancelling it.
- Error kinds (`classifyError`): `offline` and `server` retry on a 15 s / 30 s / 60 s backoff (and on the
  `online` event); `auth` and `reauth` never retry automatically and clear after a successful load;
  `rejected` (server throws `REJECT: ...` for bad input) is dropped from the queue and shown once.
- `Code.gs` starts with `/** @OnlyCurrentDoc */` so each account only grants access to this Sheet.

## Access and deploy
- Deployed as **Execute as: User accessing the web app** + **Who has access: Anyone with Google account**.
  Who can actually use it is controlled by **sharing the Sheet as Editor**. Never combine
  "Execute as: Me" with "Anyone with Google account": anyone with the link could read and write the data.
- Updating code: paste into the Apps Script editor, then **Deploy → Manage deployments → edit →
  New version** so the URL stays the same.
- Copying code to the clipboard from this Mac: the shell has no `LANG`, so plain `pbcopy` turns Thai
  into garbage. Always use `LANG=en_US.UTF-8 pbcopy < file` and check with
  `osascript -e 'the clipboard as text'`, not `pbpaste` (pbpaste hides the problem).
- Netlify still serves this repo's root on push (the moved page). No build step.

## Never commit
- `project-info.md` (old Supabase key and sync code), `recovered-data-*.json`, `import-code-*.txt`
  (real financial data). They are listed in `.gitignore` / `.git/info/exclude`.
- Email addresses, the Sheet ID, or any real amounts. The repo and the Netlify site are public.

## Conventions / guardrails
- **Font**: Kanit (Google Fonts). **Palette**: cobalt `#3B4CF0`, coral `#FF5C4D`, lemon `#FFD23F`,
  mint `#14C48B`, bubble `#FF8CC6`, violet `#8B5CF6`; bg cream `#FBF4E9`, ink `#16130F`.
- All text/background pairs pass **WCAG AA**. Re-check contrast if you change a color.
- Keep element **IDs and class names stable**; the JS wires everything by ID.
- Keep UI copy in **Thai**, with no em or en dashes.
- Month indexes in JS are 0-based: the 30 Nov deadline is `new Date(year, 10, 30)`.

## Handy commands
```bash
# all tests (Node is NOT installed; this uses the built-in JavaScriptCore)
bash tests/run.sh

# syntax check of every <script> block in the app page
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' apps-script/Index.html > /tmp/app.js && \
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
  -e 'new Function(readFile("/tmp/app.js")); print("JS OK")'
```
