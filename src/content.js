(() => {
  "use strict";

  if (window.__mousewhoLoaded) return;
  window.__mousewhoLoaded = true;

  const Hints = window.MousewhoHints;
  const Dom = window.MousewhoDom;
  const extensionApi = globalThis.browser || globalThis.chrome;
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
      const response = extensionApi.runtime.sendMessage({ command, ...payload });
      if (response && typeof response.catch === "function") response.catch(() => {});
    } catch (_) {
      // The extension context can disappear during reload/update. Ignore it.
    }
  }

  function ensureRoot() {
    if (shadow && document.documentElement.contains(host)) return shadow;

    host = document.getElementById(ROOT_ID) || document.createElement("div");
    host.id = ROOT_ID;
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      contain: "layout style paint"
    });
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
    shadow.querySelector(`[data-panel="${kind}"]`)?.remove();
  }

  function consume(event) {
    event.preventDefault();
    event.stopPropagation();
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

  function startHints(openInNewTab) {
    stopHints();
    clearPanel("help");
    const startedAt = performance.now();
    const candidates = Dom.collectVisibleCandidates(Hints.CLICKABLE_SELECTOR, { limit: HINT_LIMIT });
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

  function enterInsertMode(notify = true) {
    mode = "insert";
    if (notify) hud("-- INSERT --", 700);
  }

  function exitInsertMode(notify = true) {
    const active = document.activeElement;
    if (Dom.isEditableTarget(active) && active.blur) active.blur();
    mode = "normal";
    if (notify) hud("-- NORMAL --", 700);
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

    if (Dom.isEditableTarget(element)) {
      element.focus({ preventScroll: false });
      enterInsertMode();
      return;
    }
    clickElement(element);
  }

  function showHelp() {
    stopHints();
    clearPanel("help");
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
        <kbd>i</kbd><span>focus first visible text input and enter insert mode</span>
        <kbd>?</kbd><span>toggle this help</span>
        <kbd>Esc</kbd><span>exit hints/help or blur input from insert mode</span>
      </div>
    `;
    root.appendChild(help);
    help.focus({ preventScroll: true });
  }

  function focusFirstInput() {
    const input = Dom.findFirstVisibleInput();
    if (input) {
      input.focus();
      enterInsertMode();
      return;
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

  function handleInsertExitKey(event) {
    if (event.key === "Escape") {
      exitInsertMode();
    } else if (event.ctrlKey && event.key === "[") {
      consume(event);
      exitInsertMode();
    }
  }

  function handleNormalKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (Dom.isEditableEventTarget(event)) return false;

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
      case "i": focusFirstInput(); break;
      case "?": showHelp(); break;
      case "Escape": stopHints(); clearPanel("help"); mode = "normal"; break;
      default: handled = false;
    }

    if (handled) consume(event);
    return handled;
  }

  function handleHintKey(event) {
    if (!hintState) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;

    if (event.key === "Escape") {
      consume(event);
      stopHints();
      return true;
    }
    if (event.key === "Backspace") {
      consume(event);
      hintState.prefix = hintState.prefix.slice(0, -1);
      updateHintFilter();
      return true;
    }

    const char = event.key.toLowerCase();
    if (char.length === 1 && Hints.DEFAULT_ALPHABET.includes(char)) {
      consume(event);
      hintState.prefix += char;
      updateHintFilter();
      return true;
    }
    return false;
  }

  document.addEventListener("keydown", (event) => {
    if (mode === "insert") {
      handleInsertExitKey(event);
      return;
    }
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
    if (mode === "normal" && Dom.isEditableEventTarget(event)) {
      enterInsertMode(false);
      handleInsertExitKey(event);
      return;
    }
    if (mode !== "normal") return;
    handleNormalKey(event);
  }, true);

  document.addEventListener("focusin", (event) => {
    if ((mode === "normal" || mode === "insert") && Dom.isEditableEventTarget(event)) {
      enterInsertMode(mode !== "insert");
    }
  }, true);

  document.addEventListener("focusout", () => {
    if (mode !== "insert") return;
    setTimeout(() => {
      if (mode === "insert" && !Dom.isEditableTarget(document.activeElement)) mode = "normal";
    }, 0);
  }, true);
})();
