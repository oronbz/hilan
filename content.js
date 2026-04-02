// --- Page Detection ---

function detectHilanAttendancePage() {
  const calendar = document.querySelector("#calendar_container");
  const grid = document.querySelector(".HReportsGrid");
  if (calendar || grid) {
    chrome.runtime.sendMessage({ type: "hilan-detected" });
  }
}

detectHilanAttendancePage();

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
