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
