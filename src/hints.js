(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MousewhoHints = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  const DEFAULT_ALPHABET = "asdfghjklqwertyuiopzxcvbnm";
  const CLICKABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[role='checkbox']",
    "[role='menuitem']",
    "[role='option']",
    "[role='radio']",
    "[role='tab']",
    "[role='textbox']",
    "[onclick]",
    "[tabindex]:not([tabindex='-1'])",
    "audio[controls]",
    "video[controls]"
  ].join(",");

  function labelLength(count, alphabetLength) {
    if (count <= 0) return 0;
    let length = 1;
    let capacity = alphabetLength;
    while (capacity < count) {
      length += 1;
      capacity *= alphabetLength;
    }
    return length;
  }

  function encodeLabel(index, length, alphabet) {
    const base = alphabet.length;
    let n = index;
    let label = "";
    for (let i = 0; i < length; i += 1) {
      label = alphabet[n % base] + label;
      n = Math.floor(n / base);
    }
    return label;
  }

  function createHintLabels(count, alphabet) {
    const letters = alphabet || DEFAULT_ALPHABET;
    const length = labelLength(count, letters.length);
    const labels = new Array(count);
    for (let i = 0; i < count; i += 1) labels[i] = encodeLabel(i, length, letters);
    return labels;
  }

  function filterHintIndexes(labels, prefix) {
    const matches = [];
    for (let i = 0; i < labels.length; i += 1) {
      if (labels[i].startsWith(prefix)) matches.push(i);
    }
    return matches;
  }

  function getElementUrl(element) {
    if (!element) return "";
    const link = element.closest && element.closest("a[href], area[href]");
    if (link && link.href) return link.href;
    const href = element.getAttribute && element.getAttribute("href");
    if (href) {
      try {
        return new URL(href, document.baseURI).href;
      } catch (_) {
        return href;
      }
    }
    return "";
  }

  return {
    CLICKABLE_SELECTOR,
    DEFAULT_ALPHABET,
    createHintLabels,
    filterHintIndexes,
    getElementUrl,
    labelLength
  };
});
