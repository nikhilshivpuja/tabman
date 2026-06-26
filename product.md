# Tabman — Product Overview

**Tabman** is a browser extension for Microsoft Edge and Google Chrome that helps you manage tab overload without losing what you were reading. It watches which tabs you actually use, archives the ones you have ignored for too long, saves their context for later, and closes them to free up your browser.

---

## The problem Tabman solves

If you keep dozens of tabs open “just in case,” you already know the pain:

- You cannot find the tab you need
- Your browser slows down
- You are afraid to close something because you might lose it
- Bookmarks are too manual; “read later” lists become graveyards

Tabman is built for a simple workflow: **keep working in your browser, let idle tabs archive themselves, and search your history when you need something back.**

---

## How it works (in plain English)

1. **Tabman tracks when you switch to each tab** — not every click inside a page, but when a tab becomes the active tab you are viewing.
2. **If you have not switched to a tab for your chosen number of days** (default: 2), Tabman treats it as idle.
3. **Before closing the tab**, Tabman saves:
   - Page title
   - URL
   - Which browser window and tab group it was in (when available)
   - A short text preview from the page
   - An optional AI summary (if you provide your own API key)
4. **The tab is closed automatically** after a successful save.
5. **Everything goes into a searchable Archive** you can open anytime from the extension.

You do not need to remember to clean up tabs. Tabman does it on a schedule and when you trigger it manually.

---

## Core features

### Automatic idle-tab archiving

- Default idle period: **2 days** since you last switched to the tab
- You can change this to any value from 0–365 days in Settings
- Automatic checks run:
  - **Every 30 minutes** (background timer)
  - **On browser startup**
  - **When you save Settings**
- The Archive page also shows **when the next automatic check** is scheduled

### Smart activity tracking

Tabman only updates “last active” when you **switch to** a tab. Background tabs that finish loading are not treated as if you read them.

In Settings, the **Tracked tabs preview** shows:

- Window ID and tab group (with color), for context
- How long each tab has been idle
- Whether it is **Ready** to be archived

### Searchable archive

Open the **Archive** page from the extension popup. Your saved tabs are:

- **Grouped by browser window**, then by **tab group** (or “Ungrouped”)
- **Searchable** by title, URL, snippet, summary, domain, or group name
- **Filterable** by domain

Each archived entry shows when the tab was opened, when it was archived, and a text preview.

### Reopen without losing history

For each archived tab you can:

| Action | What it does |
|--------|----------------|
| **Open** | Opens the URL in a new tab; keeps the archive entry |
| **Open & remove** | Opens the URL and removes it from the archive |
| **Copy URL** | Copies the link to your clipboard |
| **Delete** | Removes the entry from your archive |

### Text preview (always on)

When you leave a tab, Tabman tries to capture the **first three meaningful lines** of the main page content (from `article`, `main`, or similar areas). This is used when no AI key is configured.

### Optional AI summaries

If you want richer descriptions, you can add your own API key in Settings:

- **OpenAI**
- **Google Gemini**
- **Azure OpenAI**

Tabman validates the key before use. Summaries are optional — the extension works fully without them.

**Your API keys stay on your device** in local extension storage. They are not sent to any Tabman server (there is no Tabman server).

### Cross-device sync (automatic)

Tabman can keep one shared archive across multiple computers using a **cloud-synced folder** (OneDrive, Dropbox, iCloud Drive, Google Drive desktop sync, etc.).

**One-time setup on each device:**

1. Go to **Settings → Cross-device sync**
2. Click **Choose sync folder**
3. Pick the **same folder** on every device (e.g. `OneDrive/Tabman`)

After that, Tabman automatically merges and writes `tabman-archive.json` in that folder:

- After archiving tabs
- On browser startup
- When you open the Archive page
- When you delete entries or import data

**No manual “Sync now” button is required.** Both devices contribute to the same merged library over time.

> **Note:** Cloud storage may take a minute to propagate files between devices. If you do not see updates immediately, wait briefly and reopen the Archive page.

### Export and import

You can also **Export to file** or **Import from file** (JSON) from the Archive page for backups or one-off transfers, independent of the sync folder.

---

## Settings reference

### Archiving

| Setting / button | Purpose |
|------------------|---------|
| **Archive tabs idle for (days)** | How long without switching to a tab before it is archived |
| **Archive now** | Run the idle check immediately |
| **Test: archive all tracked tabs** | Archives every tracked tab right away (ignores idle time) — use carefully |
| **Save settings** | Saves preferences and runs an archive check |

### Tracked tabs preview

| Button | Purpose |
|--------|---------|
| **Refresh list** | Updates the live list of open tabs and their idle status |
| **Reset tracking data** | Clears activity tracking (archives are not deleted). Use if timestamps look wrong |

### AI summary

Enable summaries, choose a provider, enter your API key, and optionally set a model name. Use **Validate API key** to test before archiving.

### Cross-device sync

**Choose sync folder** — link your cloud folder once per device.

---

## What gets saved for each archived tab

| Field | Description |
|-------|-------------|
| Title | Page title at archive time |
| URL | Full page address |
| Domain | Hostname (for filtering) |
| Window ID | Which browser window the tab was in |
| Tab group | Group name and color, if the tab was grouped |
| Opened at | When Tabman started tracking the tab |
| Archived at | When the tab was archived and closed |
| Last accessed at | When you last switched to the tab (or tracking start if never switched) |
| Snippet | First ~3 lines of page content |
| Summary | AI-generated summary (optional) |

Screenshots are **not** saved (by design, to keep the extension lightweight and private).

---

## Privacy and data storage

- **All archive data is stored locally** on your device in the browser’s IndexedDB
- **Sync folder** data is a JSON file you control in your own cloud storage
- **API keys** (if used) are stored locally in extension storage only
- Tabman does **not** run its own backend or collect your browsing data on a server
- The extension needs broad site access (`<all_urls>`) to read page snippets and work on any site you visit — standard for this type of tool

---

## Permissions (why Tabman needs them)

| Permission | Why |
|------------|-----|
| **tabs** | See open tabs, track activity, close archived tabs |
| **tabGroups** | Record which tab group a page was in |
| **storage** | Save settings and tracking data |
| **alarms** | Run automatic archive checks every 30 minutes |
| **scripting** | Extract text snippets from pages |
| **offscreen** | Background file sync to your linked folder |
| **&lt;all_urls&gt;** | Work on normal web pages you browse |

---

## Important limitations

### What Tabman cannot do

- **Cannot recover tabs closed before Tabman archived them** — only tabs that meet the idle rule (or are manually archived) are saved
- **Cannot read Microsoft Edge Workspaces by name** — browsers do not expose a Workspaces API; Tabman uses window ID and tab groups instead
- **Cannot know when you last viewed a tab before Tabman was installed** — tracking starts when the extension is active
- **Cannot archive restricted pages** — `edge://`, `chrome://`, extension pages, and some internal browser pages are skipped
- **Does not sync tab tracking or settings across devices** — only the archive library syncs via your chosen folder

### How “idle” is measured

- **Idle = time since you last switched to the tab**, not time since the page loaded or since you scrolled inside it
- Tabs you never switch to after tracking starts show as **“Never switched to”** and use tracking start time for idle calculations

### Automatic timing

- Archive checks are **not** tied to clock times like 2:00 or 2:30 — they run on a **30-minute interval** from when the alarm was set
- Chrome/Edge may delay background tasks slightly to save battery

---

## Recommended setup

1. Install Tabman in Edge or Chrome
2. Pin the extension to your toolbar
3. Set your preferred **idle days** (start with 2)
4. Optionally link a **sync folder** on each device you use
5. Optionally add an **AI API key** if you want summaries
6. Open **Archive** occasionally to search past tabs — it also pulls the latest merged data from your sync folder

---

## Quick troubleshooting

| Issue | What to try |
|-------|-------------|
| Tabs show as Ready but are not archiving | Click **Archive now**, **Save settings**, or wait for the next 30-minute check |
| All tabs show the same “last active” time | Click **Reset tracking data**, then switch to tabs normally |
| Cross-device sync not updating | Confirm the same folder on both devices; wait for cloud sync; reopen Archive page |
| AI summary failed | Validate your API key; check provider credits and model name |
| Extension warning about permissions | Normal for tab-management extensions; reload after updates |

---

## Who Tabman is for

- People with **too many tabs** who still want a safety net
- Researchers and developers who **reopen the same links** days later
- Anyone who wants **automatic cleanup** without manual bookmarking every page
- Users with **two or more devices** who want one searchable tab history via their own cloud folder

---

## One-line summary

**Tabman archives browser tabs you have not switched to in days, saves their title, URL, and content preview (plus optional AI summary), closes them to reduce clutter, and keeps everything in a searchable archive that can sync across your devices.**

---

*Tabman v1.0 — Edge / Chrome (Manifest V3)*
