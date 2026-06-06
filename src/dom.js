(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MousewhoDom = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit"
  ]);

  const EDITABLE_SELECTOR = [
    "input",
    "textarea",
    "select",
    "[contenteditable]",
    "[role='textbox']",
    "[role='searchbox']"
  ].join(",");

  const FOCUSABLE_INPUT_SELECTOR = [
    "input:not([type='hidden'])",
    "textarea",
    "[contenteditable]:not([contenteditable='false'])",
    "[role='textbox']",
    "[role='searchbox']"
  ].join(",");

  function getOwnerWindow(element) {
    if (element && element.ownerDocument && element.ownerDocument.defaultView) {
      return element.ownerDocument.defaultView;
    }
    return typeof window !== "undefined" ? window : null;
  }

  function getElementCtor(element) {
    const ownerWindow = getOwnerWindow(element);
    if (ownerWindow && ownerWindow.Element) return ownerWindow.Element;
    return typeof Element !== "undefined" ? Element : null;
  }

  function isElement(value) {
    const ElementCtor = getElementCtor(value);
    return Boolean(ElementCtor && value instanceof ElementCtor);
  }

  function toElement(target) {
    if (!target) return null;
    if (isElement(target)) return target;
    return target.parentElement || null;
  }

  function isTextEditable(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    if (element.matches && element.matches("input")) {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      return !NON_TEXT_INPUT_TYPES.has(type);
    }
    if (element.getAttribute && element.getAttribute("contenteditable") !== null) {
      return element.getAttribute("contenteditable").toLowerCase() !== "false";
    }
    return true;
  }

  function getShadowActiveElement(element) {
    let current = element;
    const seen = new Set();
    while (current && current.shadowRoot && current.shadowRoot.activeElement && !seen.has(current)) {
      seen.add(current);
      current = current.shadowRoot.activeElement;
    }
    return current !== element ? current : null;
  }

  function isEditableTarget(target) {
    const currentDocument = typeof document !== "undefined" ? document : null;
    const currentWindow = typeof window !== "undefined" ? window : null;
    if (!target || target === currentDocument || target === currentWindow) return false;

    const element = toElement(target);
    if (!element) return false;

    const shadowActive = getShadowActiveElement(element);
    if (shadowActive && isEditableTarget(shadowActive)) return true;

    if (element.isContentEditable) return true;

    const editable = element.closest && element.closest(EDITABLE_SELECTOR);
    return Boolean(editable && isTextEditable(editable));
  }

  function isEditableEventTarget(event) {
    if (!event) return false;
    if (event.composedPath) {
      const path = event.composedPath();
      for (let i = 0; i < path.length; i += 1) {
        if (isEditableTarget(path[i])) return true;
      }
    }
    return isEditableTarget(event.target);
  }

  function getViewport(element, viewport) {
    if (viewport) return viewport;
    const ownerWindow = getOwnerWindow(element);
    return {
      width: ownerWindow ? ownerWindow.innerWidth : 0,
      height: ownerWindow ? ownerWindow.innerHeight : 0
    };
  }

  function isUsableRect(rect, viewport) {
    return rect.width >= 2 &&
      rect.height >= 2 &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= viewport.height &&
      rect.left <= viewport.width;
  }

  function getComputedVisibility(element) {
    const ownerWindow = getOwnerWindow(element);
    if (!ownerWindow || !ownerWindow.getComputedStyle) return null;
    return ownerWindow.getComputedStyle(element);
  }

  function isVisibleCandidate(element, viewport) {
    if (!isElement(element)) return false;
    if (element.disabled || element.getAttribute("aria-hidden") === "true") return false;

    const rects = element.getClientRects();
    if (!rects.length) return false;

    const style = getComputedVisibility(element);
    if (style && (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0)) {
      return false;
    }

    const bounds = getViewport(element, viewport);
    for (let i = 0; i < rects.length; i += 1) {
      if (isUsableRect(rects[i], bounds)) return true;
    }
    return false;
  }

  function markerPoint(element, viewport) {
    const rects = element.getClientRects();
    const bounds = getViewport(element, viewport);
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (!isUsableRect(rect, bounds)) continue;
      return {
        x: Math.max(2, Math.min(bounds.width - 2, rect.left + Math.min(rect.width / 2, 24))),
        y: Math.max(8, Math.min(bounds.height - 2, rect.top + Math.min(rect.height / 2, 12))),
        top: rect.top,
        left: rect.left
      };
    }
    return null;
  }

  function collectVisibleCandidates(selector, options) {
    const config = options || {};
    const rootNode = config.root || (typeof document !== "undefined" ? document : null);
    if (!rootNode || !rootNode.querySelectorAll) return [];

    const limit = Number.isFinite(config.limit) ? config.limit : Infinity;
    const isVisible = config.isVisible || isVisibleCandidate;
    const getMarkerPoint = config.markerPoint || markerPoint;
    const found = [];
    const seen = new Set();
    const nodes = rootNode.querySelectorAll(selector);

    for (let i = 0; i < nodes.length && found.length < limit; i += 1) {
      const element = nodes[i];
      if (seen.has(element) || !isVisible(element)) continue;

      const point = getMarkerPoint(element);
      if (!point) continue;

      seen.add(element);
      found.push({ element, point });
    }

    found.sort((a, b) => (a.point.top - b.point.top) || (a.point.left - b.point.left));
    return found;
  }

  function findFirstVisibleInput(options) {
    const config = options || {};
    const rootNode = config.root || (typeof document !== "undefined" ? document : null);
    if (!rootNode || !rootNode.querySelectorAll) return null;

    const isVisible = config.isVisible || isVisibleCandidate;
    const nodes = rootNode.querySelectorAll(config.selector || FOCUSABLE_INPUT_SELECTOR);
    for (let i = 0; i < nodes.length; i += 1) {
      if (isVisible(nodes[i])) return nodes[i];
    }
    return null;
  }

  return {
    EDITABLE_SELECTOR,
    FOCUSABLE_INPUT_SELECTOR,
    NON_TEXT_INPUT_TYPES,
    collectVisibleCandidates,
    findFirstVisibleInput,
    isEditableEventTarget,
    isEditableTarget,
    isTextEditable,
    isUsableRect,
    isVisibleCandidate,
    markerPoint
  };
});
