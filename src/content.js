(() => {
  "use strict";

  if (window.__mousewhoLoaded) return;
  window.__mousewhoLoaded = true;

  const Hints = window.MousewhoHints;
  const SCROLL_STEP = 64;
  const HINT_LIMIT = 700;
  const G_SEQUENCE_MS = 650;
  const ROOT_ID = "mousewho-root";

  let mode = "normal";
  let pendingGTimer = 0;
  let hintState = null;
  let host = null;
  let shadow = null;
  let hudTimer = 0;

  function send(command, payload = {}) {
    try {
      chrome.runtime.sendMessage({ command, ...payload });
    } catch (_) {
      // The extension context can disappear during reload/update. Ignore it.
    }
  }

  function ensureRoot() {
    if (shadow && document.documentElement.contains(host)) return shadow;

    host = document.getElementById(ROOT_ID) || document.createElement("div");
    host.id = ROOT_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    host.style.contain = "layout style paint";
    (document.documentElement || document.body).appendChild(host);

    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    if (!shadow.querySelector("style")) {
      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        .hud {
          position: fixed;
          right: 14px;
          bottom: 14px;
          padding: 6px 9px;
          color: #f8fafc;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 8px;
          font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
          pointer-events: none;
        }
        .hint-layer { position: fixed; inset: 0; pointer-events: none; contain: layout style paint; }
        .hint {
          position: fixed;
          transform: translate(-2px, -55%);
          padding: 1px 4px;
          color: #111827;
          background: #fde047;
          border: 1px solid #92400e;
          border-radius: 4px;
          font: 700 11px/1.25 ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
          will-change: opacity;
        }
        .hint.miss { display: none; }
        .hint.match { background: #22c55e; border-color: #14532d; color: #052e16; }
        .bar {
          position: fixed;
          left: 50%;
          top: 18px;
          transform: translateX(-50%);
          width: min(720px, calc(100vw - 28px));
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 9px;
          color: #e5e7eb;
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(148, 163, 184, 0.32);
          border-radius: 12px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32);
          pointer-events: auto;
          font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .bar label { flex: 0 0 auto; color: #93c5fd; font-weight: 700; }
        .bar input {
          all: initial;
          flex: 1 1 auto;
          min-width: 0;
          color: #f8fafc;
          caret-color: #f8fafc;
          font: 15px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .help {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(740px, calc(100vw - 32px));
          max-height: calc(100vh - 40px);
          overflow: auto;
          padding: 16px 18px;
          color: #e5e7eb;
          background: rgba(15, 23, 42, 0.97);
          border: 1px solid rgba(148, 163, 184, 0.34);
          border-radius: 14px;
          box-shadow: 0 18px 64px rgba(0, 0, 0, 0.36);
          pointer-events: auto;
          font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .help h2 { margin: 0 0 10px; font-size: 18px; }
        .help p { margin: 8px 0; color: #cbd5e1; }
        .help-grid { display: grid; grid-template-columns: max-content 1fr; gap: 5px 14px; }
        kbd { padding: 1px 5px; border-radius: 5px; background: #334155; color: #f8fafc; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
      `;
      shadow.appendChild(style);
    }
    return shadow;
  }

  function clearPanel(kind) {
    if (!shadow) return;
    const node = shadow.querySelector(`[data-panel="${kind}"]`);
    if (node) node.remove();
  }

  function clearTransientPanels() {
    clearPanel("find");
    clearPanel("help");
  }

  function hud(text, ttl = 900) {
    const root = ensureRoot();
    let node = root.querySelector('[data-panel="hud"]');
    if (!node) {
      node = document.createElement("div");
      node.className = "hud";
      node.dataset.panel = "hud";
      root.appendChild(node);
    }
    node.textContent = text;
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => node.remove(), ttl);
  }

  function isEditable(target) {
    if (!target || target === document || target === window) return false;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    const editable = element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox'], [role='searchbox']");
    if (!editable) return false;
    if (editable.matches("input")) {
      const type = (editable.getAttribute("type") || "text").toLowerCase();
      return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
    }
    return true;
  }

  function isVisibleCandidate(element) {
    if (!(element instanceof Element)) return false;
    if (element.disabled || element.getAttribute("aria-hidden") === "true") return false;
    const rects = element.getClientRects();
    if (!rects.length) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;

    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) continue;
      return true;
    }
    return false;
  }

  function markerPoint(element) {
    const rects = element.getClientRects();
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) continue;
      return {
        x: Math.max(2, Math.min(innerWidth - 2, rect.left + Math.min(rect.width / 2, 24))),
        y: Math.max(8, Math.min(innerHeight - 2, rect.top + Math.min(rect.height / 2, 12))),
        top: rect.top,
        left: rect.left
      };
    }
    return null;
  }

  function collectCandidates() {
    const found = [];
    const seen = new Set();
    const nodes = document.querySelectorAll(Hints.CLICKABLE_SELECTOR);
    for (let i = 0; i < nodes.length && found.length < HINT_LIMIT; i += 1) {
      const element = nodes[i];
      if (seen.has(element) || !isVisibleCandidate(element)) continue;
      const point = markerPoint(element);
      if (!point) continue;
      seen.add(element);
      found.push({ element, point });
    }
    found.sort((a, b) => (a.point.top - b.point.top) || (a.point.left - b.point.left));
    return found;
  }

  function startHints(openInNewTab) {
    stopHints();
    clearTransientPanels();
    const startedAt = performance.now();
    const candidates = collectCandidates();
    if (!candidates.length) {
      hud("no clickable targets");
      return;
    }

    const labels = Hints.createHintLabels(candidates.length);
    const root = ensureRoot();
    const layer = document.createElement("div");
    layer.className = "hint-layer";
    layer.dataset.panel = "hints";

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < candidates.length; i += 1) {
      const marker = document.createElement("span");
      marker.className = "hint";
      marker.dataset.index = String(i);
      marker.textContent = labels[i];
      marker.style.left = `${candidates[i].point.x}px`;
      marker.style.top = `${candidates[i].point.y}px`;
      fragment.appendChild(marker);
    }
    layer.appendChild(fragment);
    root.appendChild(layer);

    hintState = {
      candidates,
      labels,
      layer,
      markers: Array.from(layer.children),
      openInNewTab,
      prefix: ""
    };
    mode = "hints";
    updateHintFilter();
    hud(`${candidates.length} hints in ${Math.round(performance.now() - startedAt)}ms`, 700);
  }

  function stopHints() {
    if (hintState && hintState.layer) hintState.layer.remove();
    hintState = null;
    if (mode === "hints") mode = "normal";
  }

  function updateHintFilter() {
    if (!hintState) return;
    const { labels, markers, prefix } = hintState;
    let exact = -1;
    let visible = 0;
    for (let i = 0; i < labels.length; i += 1) {
      const label = labels[i];
      const matches = label.startsWith(prefix);
      markers[i].classList.toggle("miss", !matches);
      markers[i].classList.toggle("match", Boolean(prefix) && matches);
      if (matches) visible += 1;
      if (label === prefix) exact = i;
    }
    if (exact >= 0) activateHint(exact);
    else if (prefix && visible === 0) {
      hintState.prefix = prefix.slice(0, -1);
      hud("no match");
      updateHintFilter();
    }
  }

  function clickElement(element) {
    if (!element) return;
    try { element.focus({ preventScroll: true }); } catch (_) {}
    const options = { bubbles: true, cancelable: true, view: window, button: 0 };
    element.dispatchEvent(new MouseEvent("mouseover", options));
    element.dispatchEvent(new MouseEvent("mousedown", options));
    element.dispatchEvent(new MouseEvent("mouseup", options));
    element.click();
  }

  function activateHint(index) {
    if (!hintState) return;
    const { element } = hintState.candidates[index];
    const openInNewTab = hintState.openInNewTab;
    stopHints();

    if (openInNewTab) {
      const url = Hints.getElementUrl(element);
      if (url) send("openTab", { url, active: false });
      else {
        hud("target has no URL; clicking");
        clickElement(element);
      }
      return;
    }

    if (element.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox'], [role='searchbox']")) {
      element.focus({ preventScroll: false });
      return;
    }
    clickElement(element);
  }

  function startFind() {
    stopHints();
    clearTransientPanels();
    mode = "find";

    const root = ensureRoot();
    const bar = document.createElement("form");
    bar.className = "bar";
    bar.dataset.panel = "find";
    bar.innerHTML = `<label>find</label><input autocomplete="off" spellcheck="false" placeholder="Find in page" />`;
    root.appendChild(bar);
    const input = bar.querySelector("input");
    input.focus();

    function run(backward = false) {
      if (!input.value) return;
      const ok = window.find(input.value, false, backward, true, false, false, false);
      if (!ok) hud("not found");
    }

    bar.addEventListener("submit", (event) => {
      event.preventDefault();
      run(event.shiftKey);
    });
    input.addEventListener("input", () => run(false));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModePanel("find");
      } else if (event.key === "Enter") {
        event.preventDefault();
        run(event.shiftKey);
      }
    });
  }

  function closeModePanel(kind) {
    clearPanel(kind);
    if (mode === kind) mode = "normal";
  }

  function showHelp() {
    stopHints();
    clearTransientPanels();
    mode = "help";
    const root = ensureRoot();
    const help = document.createElement("div");
    help.className = "help";
    help.dataset.panel = "help";
    help.tabIndex = -1;
    help.innerHTML = `
      <h2>Mousewho keys</h2>
      <div class="help-grid">
        <kbd>j/k</kbd><span>scroll down/up</span>
        <kbd>h/l</kbd><span>scroll left/right</span>
        <kbd>d/u</kbd><span>scroll half-page down/up</span>
        <kbd>gg/G</kbd><span>top/bottom of page</span>
        <kbd>f/F</kbd><span>hint-click / open hinted link in a background tab</span>
        <kbd>J/K</kbd><span>previous/next tab</span>
        <kbd>/</kbd><span>lightweight find in page</span>
        <kbd>i</kbd><span>focus first visible text input</span>
        <kbd>?</kbd><span>toggle this help</span>
        <kbd>Esc</kbd><span>exit current mode</span>
      </div>
      <p>Chrome does not expose an API to focus the omnibox; use native <kbd>Ctrl/⌘+L</kbd> or <kbd>Ctrl/⌘+T</kbd>.</p>
    `;
    root.appendChild(help);
    help.focus({ preventScroll: true });
  }

  function focusFirstInput() {
    const nodes = document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable=''], [contenteditable='true'], [role='textbox'], [role='searchbox']");
    for (let i = 0; i < nodes.length; i += 1) {
      if (isVisibleCandidate(nodes[i])) {
        nodes[i].focus();
        return;
      }
    }
    hud("no input found");
  }

  function scrollByFast(x, y) {
    window.scrollBy({ left: x, top: y, behavior: "auto" });
  }

  function scrollToFast(y) {
    window.scrollTo({ top: y, behavior: "auto" });
  }

  function cancelGSequence() {
    clearTimeout(pendingGTimer);
    pendingGTimer = 0;
  }

  function handleNormalKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (isEditable(event.target)) return false;

    const key = event.key;
    let handled = true;

    switch (key) {
      case "j": scrollByFast(0, SCROLL_STEP); break;
      case "k": scrollByFast(0, -SCROLL_STEP); break;
      case "h": scrollByFast(-SCROLL_STEP, 0); break;
      case "l": scrollByFast(SCROLL_STEP, 0); break;
      case "d": scrollByFast(0, Math.floor(innerHeight * 0.55)); break;
      case "u": scrollByFast(0, -Math.floor(innerHeight * 0.55)); break;
      case "G": scrollToFast(document.scrollingElement ? document.scrollingElement.scrollHeight : document.body.scrollHeight); break;
      case "g":
        if (pendingGTimer) {
          cancelGSequence();
          scrollToFast(0);
        } else {
          pendingGTimer = setTimeout(cancelGSequence, G_SEQUENCE_MS);
        }
        break;
      case "f": startHints(false); break;
      case "F": startHints(true); break;
      case "J": send("previousTab"); break;
      case "K": send("nextTab"); break;
      case "/": startFind(); break;
      case "i": focusFirstInput(); break;
      case "?": showHelp(); break;
      case "Escape": stopHints(); clearTransientPanels(); mode = "normal"; break;
      default: handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
    return handled;
  }

  function handleHintKey(event) {
    if (!hintState) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stopHints();
      return true;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      hintState.prefix = hintState.prefix.slice(0, -1);
      updateHintFilter();
      return true;
    }

    const char = event.key.toLowerCase();
    if (char.length === 1 && Hints.DEFAULT_ALPHABET.includes(char)) {
      event.preventDefault();
      event.stopPropagation();
      hintState.prefix += char;
      updateHintFilter();
      return true;
    }
    return false;
  }

  document.addEventListener("keydown", (event) => {
    if (mode === "hints") {
      handleHintKey(event);
      return;
    }
    if (mode === "help" && event.key === "Escape") {
      event.preventDefault();
      clearPanel("help");
      mode = "normal";
      return;
    }
    if (mode !== "normal") return;
    handleNormalKey(event);
  }, true);
})();
