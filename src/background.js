"use strict";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function switchTab(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (!tabs.length) return;
  const currentIndex = tabs.findIndex((tab) => tab.active);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  await chrome.tabs.update(tabs[nextIndex].id, { active: true });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  (async () => {
    switch (message && message.command) {
      case "nextTab":
        await switchTab(1);
        break;
      case "previousTab":
        await switchTab(-1);
        break;
      case "closeTab": {
        const tabId = sender.tab && sender.tab.id;
        if (tabId) await chrome.tabs.remove(tabId);
        break;
      }
      case "newTab":
        await chrome.tabs.create({ active: true });
        break;
      case "openTab":
        if (message.url) await chrome.tabs.create({ url: message.url, active: Boolean(message.active) });
        break;
      case "reload": {
        const tab = sender.tab || await getActiveTab();
        if (tab && tab.id) await chrome.tabs.reload(tab.id);
        break;
      }
      default:
        break;
    }
  })().catch(() => {
    // Keep keyboard handling snappy; background failures are non-fatal.
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "next-tab") switchTab(1);
  if (command === "previous-tab") switchTab(-1);
});
