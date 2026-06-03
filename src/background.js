"use strict";

const TAB_MESSAGE_DIRECTIONS = Object.freeze({
  nextTab: 1,
  previousTab: -1
});

const TAB_COMMAND_DIRECTIONS = Object.freeze({
  "next-tab": 1,
  "previous-tab": -1
});

async function switchTab(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (!tabs.length) return;
  const currentIndex = tabs.findIndex((tab) => tab.active);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  await chrome.tabs.update(tabs[nextIndex].id, { active: true });
}

async function openTab(url, active) {
  if (url) await chrome.tabs.create({ url, active: Boolean(active) });
}

async function handleRuntimeMessage(message) {
  const command = message && message.command;
  if (Object.prototype.hasOwnProperty.call(TAB_MESSAGE_DIRECTIONS, command)) {
    await switchTab(TAB_MESSAGE_DIRECTIONS[command]);
    return;
  }
  if (command === "openTab") await openTab(message.url, message.active);
}

function ignoreFailure(promise) {
  promise.catch(() => {
    // Keep keyboard handling snappy; background failures are non-fatal.
  });
}

chrome.runtime.onMessage.addListener((message) => {
  ignoreFailure(handleRuntimeMessage(message));
});

chrome.commands.onCommand.addListener((command) => {
  if (Object.prototype.hasOwnProperty.call(TAB_COMMAND_DIRECTIONS, command)) {
    ignoreFailure(switchTab(TAB_COMMAND_DIRECTIONS[command]));
  }
});
