# Hilan Auto-Fill Chrome Extension

A Manifest V3 Chrome extension that auto-fills the Hilan monthly attendance form at `gett.net.hilan.co.il`, replacing the current Claude Code `/hilan` skill with a standalone, zero-dependency tool.

## Goals

- Eliminate the Claude Code dependency — standalone extension, no AI needed
- One-click fill of all currently loaded day rows in the attendance detail form
- Persistent, synced settings via `chrome.storage.sync`
- Badge indicator when on the Hilan attendance page

## Non-Goals

- No calendar navigation or day selection — only fills rows already loaded in the detail form
- No login automation — user must be logged in
- Not published to Chrome Web Store (local install via developer mode)

## Architecture

```
hilan/
├── manifest.json          # Manifest V3 config
├── popup.html             # Settings UI
├── popup.js               # Popup logic + fill trigger
├── content.js             # Injected into Hilan — badge detection + fill logic
├── background.js          # Service worker — badge management
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Communication Flow

1. **Page detection:** Content script loads on `*://gett.net.hilan.co.il/*`, detects the attendance page by checking for `#calendar_container` or the reports grid, sends `{ type: "hilan-detected" }` to the service worker.
2. **Badge:** Service worker receives the detection message and sets a badge on the extension icon (colored dot or "!"). Badge clears when the tab navigates away or closes.
3. **Fill trigger:** User opens popup, clicks "Fill Now". Popup reads settings from `chrome.storage.sync`, sends `{ type: "fill", settings }` to the content script on the active tab.
4. **Fill execution:** Content script fills all loaded entry/exit fields and handles flexi Sundays. Returns `{ type: "fill-result", count }` to the popup.
5. **Auto-save:** If enabled in settings, content script clicks the save button after a 500ms delay.

## Popup UI

Approximately 300px wide, minimal design:

- **Entry Time** — text input, default `09:00`, format `HH:MM`
- **Exit Time** — text input, default `18:00`, format `HH:MM`
- **Flexi Sundays** — radio group:
  - None
  - Last Sunday only (default)
  - All Sundays
- **Auto-save after fill** — checkbox, default off
- **Fill Now** — primary action button, disabled when not on the Hilan attendance page
- **Status line** — shows "Ready", "Filling...", "Done! Filled N days", or "Not on Hilan page"

Settings auto-persist to `chrome.storage.sync` on change. No separate save button.

## Content Script

Runs on `*://gett.net.hilan.co.il/*`. Three responsibilities:

### 1. Page Detection & Badge

On load, checks for attendance page indicators (`#calendar_container` or `.HReportsGrid`). If found, sends a message to the service worker to set the extension badge. Badge clears on navigation away.

### 2. Fill Logic

Triggered by `{ type: "fill" }` message from the popup.

**Finding inputs:**
- Entry inputs: `document.querySelectorAll('input[id*="ManualEntry_EmployeeReports"]')`
- Exit inputs: `document.querySelectorAll('input[id*="ManualExit_EmployeeReports"]')`

**Setting values** (event sequence required by Hilan's form validation):
1. Focus the input
2. Dispatch `focus` event
3. Set `.value` to the time string
4. Dispatch `input` event (bubbles: true)
5. Dispatch `change` event (bubbles: true)
6. Blur the input
7. Dispatch `blur` event

**Flexi Sundays:**
1. Find day labels: `span[id*="cellOf_ReportDate_row"]`
2. Identify Sundays by checking `.innerText` for "יום א"
3. Extract row index from the element ID (regex: `/row_(\d+)/`)
4. For "last Sunday only" — keep only the highest index
5. For identified Sunday rows:
   - Clear entry and exit time inputs (set to empty string using the same event sequence)
   - Set report type dropdown to flexi: `select[id*="Symbol.SymbolId_EmployeeReports_row_{idx}_0"]` → value `18`, dispatch `change` event

Returns the count of filled days to the popup.

### 3. Auto-Save

If auto-save is enabled, after filling completes:
- Wait 500ms for form to settle
- Click the save button: `document.getElementById('ctl00_mp_btnSave')` (falls back to querying for a button with text "שמירה" if the ID changes)

## Service Worker (background.js)

Minimal — handles two things:
- Receives `{ type: "hilan-detected" }` from content script → sets badge text/color on that tab
- Listens for tab updates/removals → clears badge when leaving the Hilan page

## Settings Schema

Stored in `chrome.storage.sync`:

```json
{
  "entryTime": "09:00",
  "exitTime": "18:00",
  "flexiSundays": "last",
  "autoSave": false
}
```

- `entryTime` — string, `HH:MM` format, default `"09:00"`
- `exitTime` — string, `HH:MM` format, default `"18:00"`
- `flexiSundays` — `"none"` | `"last"` | `"all"`, default `"last"`
- `autoSave` — boolean, default `false`

## Manifest V3 Configuration

- `permissions`: `["activeTab", "storage"]`
- `host_permissions`: `["*://gett.net.hilan.co.il/*"]`
- `content_scripts`: match `*://gett.net.hilan.co.il/*`, inject `content.js`
- `action`: popup is `popup.html`
- `background`: service worker is `background.js`

## Error Handling

- If no entry/exit inputs found on page, report "No day rows loaded — load days first in the calendar" in status
- If time format is invalid, highlight the input in the popup (basic HTML5 pattern validation)
- Content script wrapped in try/catch, reports errors back to popup status line

## Testing

Manual testing only:
1. Load extension in developer mode
2. Navigate to Hilan attendance page
3. Load some days via the calendar
4. Click "Fill Now" and verify fields are filled correctly
5. Test flexi Sunday marking
6. Test auto-save toggle
