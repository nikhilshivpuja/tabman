# Tabman

Edge/Chrome extension that archives idle tabs (title, URL, text snippet or AI summary), closes them automatically, and keeps a searchable local archive.

## Load in Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`tabman`)

## Usage

- **Popup** — links to Archive and Settings
- **Settings → Archive now** — immediately archives tabs that meet the idle-day threshold and closes them
- **Settings → Test: archive all tracked tabs** — archives every tracked tab right now (for testing)
- **Archive page** — search, filter by domain, grouped by open date
- **Export / Import** — JSON file for backup or cross-device use
- **Sync folder** — link a OneDrive/Dropbox folder on each device; archives auto-merge to `tabman-archive.json` (no manual sync)

## Defaults

- Idle threshold: **2 days** since last tab switch
- Without AI key: first **3 lines** of article/main content
- With valid API key: optional **AI summary** (OpenAI, Gemini, or Azure OpenAI)
