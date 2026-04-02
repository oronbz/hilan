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
