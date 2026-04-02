# Hilan Auto-Fill Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that auto-fills the Hilan attendance form with configurable entry/exit times, flexi Sunday support, and optional auto-save.

**Architecture:** Flat Chrome extension — manifest, popup (HTML + JS), content script for page interaction, service worker for badge management. Communication via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`. Settings stored in `chrome.storage.sync`.

**Tech Stack:** Manifest V3, vanilla JS, Chrome Extension APIs (`storage`, `tabs`, `runtime`, `action`)

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | Extension config — permissions, content script registration, popup, service worker |
| `background.js` | Service worker — badge set/clear on tab events |
| `content.js` | Injected on Hilan — page detection, fill logic, flexi Sunday, auto-save |
| `popup.html` | Settings UI — time inputs, radio group, checkbox, fill button, status |
| `popup.js` | Popup logic — load/save settings, detect Hilan tab, send fill message |
| `icons/icon16.png` | Toolbar icon (16x16) |
| `icons/icon48.png` | Extensions page icon (48x48) |
| `icons/icon128.png` | Install dialog icon (128x128) |

---

### Task 1: Manifest & Icons

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Hilan Auto-Fill",
  "version": "1.0.0",
  "description": "Auto-fill the Hilan attendance form with one click",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["*://gett.net.hilan.co.il/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["*://gett.net.hilan.co.il/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Generate placeholder icons**

Create simple colored-square PNG icons at 16x16, 48x48, and 128x128. Use a script or any tool — these are placeholders. A green square works fine.

```bash
mkdir -p icons
# Using ImageMagick (or create manually in any image editor):
convert -size 16x16 xc:#4CAF50 icons/icon16.png
convert -size 48x48 xc:#4CAF50 icons/icon48.png
convert -size 128x128 xc:#4CAF50 icons/icon128.png
```

If ImageMagick isn't available, create them with a canvas-based Node script or any tool that outputs PNG files. The exact method doesn't matter — just produce three green PNGs at the right sizes.

- [ ] **Step 3: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: add manifest.json and placeholder icons"
```

---

### Task 2: Service Worker (Badge Management)

**Files:**
- Create: `background.js`

- [ ] **Step 1: Create `background.js`**

```js
// Set badge when content script detects the Hilan attendance page
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "hilan-detected" && sender.tab) {
    chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: sender.tab.id });
  }
});

// Clear badge when a tab navigates away from Hilan
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && !changeInfo.url.includes("gett.net.hilan.co.il")) {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

// Clear badge when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({ text: "", tabId });
});
```

- [ ] **Step 2: Commit**

```bash
git add background.js
git commit -m "feat: add service worker for badge management"
```

---

### Task 3: Content Script (Page Detection + Fill Logic)

**Files:**
- Create: `content.js`

- [ ] **Step 1: Create `content.js` with page detection**

```js
// --- Page Detection ---

function detectHilanAttendancePage() {
  const calendar = document.querySelector("#calendar_container");
  const grid = document.querySelector(".HReportsGrid");
  if (calendar || grid) {
    chrome.runtime.sendMessage({ type: "hilan-detected" });
  }
}

detectHilanAttendancePage();
```

- [ ] **Step 2: Add the `setInputValue` helper**

This helper applies the full event sequence that Hilan's form validation requires. Append to `content.js`:

```js
// --- Helpers ---

function setInputValue(input, value) {
  input.focus();
  input.dispatchEvent(new Event("focus", { bubbles: true }));
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}
```

- [ ] **Step 3: Add the fill logic**

Append to `content.js`:

```js
// --- Fill Logic ---

function fillAttendance(settings) {
  const entryInputs = document.querySelectorAll('input[id*="ManualEntry_EmployeeReports"]');
  const exitInputs = document.querySelectorAll('input[id*="ManualExit_EmployeeReports"]');

  if (entryInputs.length === 0) {
    return { success: false, error: "No day rows loaded — load days first in the calendar" };
  }

  // Fill all entry/exit times
  entryInputs.forEach((input) => setInputValue(input, settings.entryTime));
  exitInputs.forEach((input) => setInputValue(input, settings.exitTime));

  let filledCount = entryInputs.length;

  // Handle flexi Sundays
  if (settings.flexiSundays !== "none") {
    const dayLabels = document.querySelectorAll('span[id*="cellOf_ReportDate_row"]');
    const sundayIndices = [];

    dayLabels.forEach((label) => {
      if (label.innerText.includes("יום א")) {
        const match = label.id.match(/row_(\d+)/);
        if (match) {
          sundayIndices.push(parseInt(match[1], 10));
        }
      }
    });

    const indicesToMark =
      settings.flexiSundays === "last"
        ? sundayIndices.length > 0
          ? [Math.max(...sundayIndices)]
          : []
        : sundayIndices;

    indicesToMark.forEach((idx) => {
      // Clear entry/exit for this Sunday
      const entry = document.querySelector(`input[id*="ManualEntry_EmployeeReports_row_${idx}_0"]`);
      const exit = document.querySelector(`input[id*="ManualExit_EmployeeReports_row_${idx}_0"]`);
      if (entry) setInputValue(entry, "");
      if (exit) setInputValue(exit, "");

      // Set report type to flexi (value 18)
      const select = document.querySelector(`select[id*="Symbol.SymbolId_EmployeeReports_row_${idx}_0"]`);
      if (select) {
        select.value = "18";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  return { success: true, count: filledCount };
}
```

- [ ] **Step 4: Add auto-save logic and message listener**

Append to `content.js`:

```js
// --- Auto-Save ---

function clickSave() {
  const saveBtn =
    document.getElementById("ctl00_mp_btnSave") ||
    Array.from(document.querySelectorAll("input[type='submit'], button")).find(
      (el) => el.value === "שמירה" || el.textContent.includes("שמירה")
    );
  if (saveBtn) {
    saveBtn.click();
    return true;
  }
  return false;
}

// --- Message Listener ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "fill") {
    try {
      const result = fillAttendance(message.settings);

      if (result.success && message.settings.autoSave) {
        setTimeout(() => {
          clickSave();
        }, 500);
      }

      sendResponse(result);
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true; // keep sendResponse channel open for async
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add content.js
git commit -m "feat: add content script with fill logic, flexi Sundays, auto-save"
```

---

### Task 4: Popup HTML

**Files:**
- Create: `popup.html`

- [ ] **Step 1: Create `popup.html`**

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      padding: 16px;
      color: #333;
    }

    h1 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 14px;
      color: #1a1a1a;
    }

    .field {
      margin-bottom: 12px;
    }

    .field label {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
      color: #555;
    }

    .field input[type="text"] {
      width: 80px;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
      text-align: center;
    }

    .field input[type="text"]:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    .radio-group {
      margin-bottom: 12px;
    }

    .radio-group .group-label {
      font-weight: 500;
      margin-bottom: 6px;
      color: #555;
    }

    .radio-group label {
      display: block;
      padding: 2px 0;
      cursor: pointer;
      font-weight: normal;
    }

    .radio-group input[type="radio"] {
      margin-left: 6px;
    }

    .checkbox-field {
      margin-bottom: 14px;
    }

    .checkbox-field label {
      cursor: pointer;
      font-weight: normal;
    }

    .checkbox-field input[type="checkbox"] {
      margin-left: 6px;
    }

    #fillBtn {
      width: 100%;
      padding: 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    #fillBtn:hover:not(:disabled) {
      background: #43A047;
    }

    #fillBtn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    #status {
      margin-top: 10px;
      text-align: center;
      font-size: 12px;
      color: #777;
    }

    #status.error {
      color: #d32f2f;
    }

    #status.success {
      color: #2e7d32;
    }
  </style>
</head>
<body>
  <h1>Hilan Auto-Fill</h1>

  <div class="field">
    <label for="entryTime">שעת כניסה</label>
    <input type="text" id="entryTime" pattern="[0-2]\d:[0-5]\d" placeholder="09:00">
  </div>

  <div class="field">
    <label for="exitTime">שעת יציאה</label>
    <input type="text" id="exitTime" pattern="[0-2]\d:[0-5]\d" placeholder="18:00">
  </div>

  <div class="radio-group">
    <div class="group-label">פלקסי ביום ראשון</div>
    <label><input type="radio" name="flexiSundays" value="none"> ללא</label>
    <label><input type="radio" name="flexiSundays" value="last" checked> יום ראשון אחרון בלבד</label>
    <label><input type="radio" name="flexiSundays" value="all"> כל ימי ראשון</label>
  </div>

  <div class="checkbox-field">
    <label><input type="checkbox" id="autoSave"> שמירה אוטומטית אחרי מילוי</label>
  </div>

  <button id="fillBtn" disabled>מלא עכשיו</button>
  <div id="status">בודק...</div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add popup.html
git commit -m "feat: add popup HTML with settings UI"
```

---

### Task 5: Popup JavaScript

**Files:**
- Create: `popup.js`

- [ ] **Step 1: Create `popup.js`**

```js
const DEFAULTS = {
  entryTime: "09:00",
  exitTime: "18:00",
  flexiSundays: "last",
  autoSave: false,
};

const entryTimeInput = document.getElementById("entryTime");
const exitTimeInput = document.getElementById("exitTime");
const flexiRadios = document.querySelectorAll('input[name="flexiSundays"]');
const autoSaveCheckbox = document.getElementById("autoSave");
const fillBtn = document.getElementById("fillBtn");
const statusEl = document.getElementById("status");

// --- Load Settings ---

chrome.storage.sync.get(DEFAULTS, (settings) => {
  entryTimeInput.value = settings.entryTime;
  exitTimeInput.value = settings.exitTime;
  document.querySelector(`input[name="flexiSundays"][value="${settings.flexiSundays}"]`).checked = true;
  autoSaveCheckbox.checked = settings.autoSave;
});

// --- Auto-Save Settings on Change ---

function saveSettings() {
  const settings = {
    entryTime: entryTimeInput.value,
    exitTime: exitTimeInput.value,
    flexiSundays: document.querySelector('input[name="flexiSundays"]:checked').value,
    autoSave: autoSaveCheckbox.checked,
  };
  chrome.storage.sync.set(settings);
}

entryTimeInput.addEventListener("change", saveSettings);
exitTimeInput.addEventListener("change", saveSettings);
flexiRadios.forEach((r) => r.addEventListener("change", saveSettings));
autoSaveCheckbox.addEventListener("change", saveSettings);

// --- Detect Hilan Tab ---

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = type || "";
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.url && tab.url.includes("gett.net.hilan.co.il")) {
    fillBtn.disabled = false;
    setStatus("מוכן", "");
  } else {
    fillBtn.disabled = true;
    setStatus("לא בדף הנוכחות של הילן", "error");
  }
});

// --- Fill Button ---

fillBtn.addEventListener("click", () => {
  fillBtn.disabled = true;
  setStatus("ממלא...", "");

  const settings = {
    entryTime: entryTimeInput.value,
    exitTime: exitTimeInput.value,
    flexiSundays: document.querySelector('input[name="flexiSundays"]:checked').value,
    autoSave: autoSaveCheckbox.checked,
  };

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "fill", settings }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus("שגיאה: לא ניתן לתקשר עם הדף", "error");
        fillBtn.disabled = false;
        return;
      }

      if (response && response.success) {
        setStatus(`בוצע! מולאו ${response.count} ימים`, "success");
      } else {
        setStatus(response?.error || "שגיאה לא ידועה", "error");
        fillBtn.disabled = false;
      }
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add popup.js
git commit -m "feat: add popup JS — settings persistence, fill trigger, status"
```

---

### Task 6: Load Extension & Manual Test

- [ ] **Step 1: Verify extension loads**

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select the `hilan/` directory
4. Verify: extension appears with green icon, no errors in the extension card

- [ ] **Step 2: Test badge detection**

1. Navigate to `https://gett.net.hilan.co.il/Hilannetv2/Attendance/calendarpage.aspx?isOnSelf=true`
2. Log in if needed
3. Verify: "!" badge appears on the extension icon

- [ ] **Step 3: Test fill**

1. On the Hilan attendance page, load some days via the calendar (click "ימים שגויים" or select days manually)
2. Click the extension icon to open the popup
3. Verify: status shows "מוכן", "מלא עכשיו" button is enabled
4. Click "מלא עכשיו"
5. Verify: all entry fields show 09:00, all exit fields show 18:00
6. Verify: status shows "בוצע! מולאו N ימים"

- [ ] **Step 4: Test flexi Sundays**

1. Reload the days
2. In popup, ensure "יום ראשון אחרון בלבד" is selected
3. Click "מלא עכשיו"
4. Verify: last Sunday row has empty entry/exit and report type is פלקסי (18)
5. Change to "כל ימי ראשון", reload days, fill again
6. Verify: all Sunday rows are marked flexi

- [ ] **Step 5: Test auto-save**

1. Check the "שמירה אוטומטית" checkbox
2. Reload days, click "מלא עכשיו"
3. Verify: form auto-saves after filling (page does a postback)

- [ ] **Step 6: Test settings persistence**

1. Set entry to 10:00, exit to 19:00
2. Close and reopen the popup
3. Verify: settings are preserved

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjustments from manual testing"
```

Only commit this step if fixes were needed. Skip if everything worked.
