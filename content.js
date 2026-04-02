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

function daysInMonth(month) {
  // Use current year; month is 1-based
  const year = new Date().getFullYear();
  return new Date(year, month, 0).getDate();
}

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

  // Determine which rows are today or in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabelsAll = document.querySelectorAll('span[id*="cellOf_ReportDate_row"]');
  const futureRows = new Set();

  dayLabelsAll.forEach((label) => {
    const match = label.id.match(/row_(\d+)/);
    const dateMatch = label.innerText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (match && dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-based
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
      const rowDate = new Date(year, month, day);
      if (rowDate > today) {
        futureRows.add(parseInt(match[1], 10));
      }
    }
  });

  // Fill entry/exit times and reset report type — skip future dates
  let filledCount = 0;
  entryInputs.forEach((input) => {
    const rowMatch = input.id.match(/row_(\d+)/);
    const rowIdx = rowMatch ? parseInt(rowMatch[1], 10) : -1;
    if (!futureRows.has(rowIdx)) {
      setInputValue(input, settings.entryTime);
      filledCount++;
    }
  });
  exitInputs.forEach((input) => {
    const rowMatch = input.id.match(/row_(\d+)/);
    const rowIdx = rowMatch ? parseInt(rowMatch[1], 10) : -1;
    if (!futureRows.has(rowIdx)) {
      setInputValue(input, settings.exitTime);
    }
  });
  const allSelects = document.querySelectorAll('select[id*="Symbol.SymbolId_EmployeeReports"]');
  allSelects.forEach((select) => {
    const rowMatch = select.id.match(/row_(\d+)/);
    const rowIdx = rowMatch ? parseInt(rowMatch[1], 10) : -1;
    if (!futureRows.has(rowIdx)) {
      const hasAttendance = Array.from(select.options).some((o) => o.value === "0");
      select.value = hasAttendance ? "0" : select.options[0].value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // Handle flexi Sundays
  if (settings.flexiSundays !== "none") {
    const dayLabels = document.querySelectorAll('span[id*="cellOf_ReportDate_row"]');
    const sundayRows = [];

    dayLabels.forEach((label) => {
      if (/יום\s*א/.test(label.innerText)) {
        const match = label.id.match(/row_(\d+)/);
        if (match) {
          // Parse date from label text (e.g., "יום א 27/04/2026" or "יום א' 27/04")
          const dateMatch = label.innerText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
          const day = dateMatch ? parseInt(dateMatch[1], 10) : null;
          const month = dateMatch ? parseInt(dateMatch[2], 10) : null;
          sundayRows.push({ idx: parseInt(match[1], 10), day, month });
        }
      }
    });

    let indicesToMark;
    if (settings.flexiSundays === "all") {
      indicesToMark = sundayRows.map((r) => r.idx);
    } else {
      // "last" — only mark the last Sunday of the month, and only if it's loaded
      // Group by month, find last Sunday of each month, check if it's truly the last
      indicesToMark = [];
      const byMonth = {};
      sundayRows.forEach((r) => {
        if (r.month != null) {
          if (!byMonth[r.month]) byMonth[r.month] = [];
          byMonth[r.month].push(r);
        }
      });

      for (const monthSundays of Object.values(byMonth)) {
        // Find the Sunday with the highest day number in this month
        const lastSunday = monthSundays.reduce((a, b) => (a.day > b.day ? a : b));
        // Check that no later Sunday can exist in this month
        // (next Sunday would be day + 7; if that's still in the same month, this isn't the last)
        if (lastSunday.day + 7 > 31 || lastSunday.day + 7 > daysInMonth(lastSunday.month)) {
          indicesToMark.push(lastSunday.idx);
        }
      }
    }

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
