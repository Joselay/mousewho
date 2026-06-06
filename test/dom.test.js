const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectVisibleCandidates,
  isEditableEventTarget,
  isEditableTarget,
  isVisibleCandidate,
  markerPoint
} = require("../src/dom.js");

function createFakeWindow() {
  class FakeElement {
    constructor(options = {}) {
      this.nodeType = 1;
      this.tagName = (options.tagName || "div").toUpperCase();
      this.parentElement = options.parentElement || null;
      this.disabled = Boolean(options.disabled);
      this.isContentEditable = Boolean(options.isContentEditable);
      this.rects = options.rects || [];
      this.attributes = Object.assign({}, options.attributes);
      this.styleState = Object.assign({ visibility: "visible", display: "block", opacity: "1" }, options.styleState);
      this.shadowRoot = options.shadowRoot || null;
      this.ownerDocument = { defaultView: fakeWindow };
    }

    closest(selector) {
      if (this.matches(selector)) return this;
      return this.parentElement && this.parentElement.closest ? this.parentElement.closest(selector) : null;
    }

    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }

    getClientRects() {
      return this.rects;
    }

    matches(selector) {
      if (selector === "input") return this.tagName === "INPUT";
      if (selector.includes("input") && this.tagName === "INPUT") return true;
      if (selector.includes("textarea") && this.tagName === "TEXTAREA") return true;
      if (selector.includes("select") && this.tagName === "SELECT") return true;
      if (selector.includes("[contenteditable]") && Object.prototype.hasOwnProperty.call(this.attributes, "contenteditable")) return true;
      if (selector.includes("[contenteditable='true']") && this.attributes.contenteditable === "true") return true;
      if (selector.includes("[contenteditable='']") && this.attributes.contenteditable === "") return true;
      if (selector.includes("[role='textbox']") && this.attributes.role === "textbox") return true;
      if (selector.includes("[role='searchbox']") && this.attributes.role === "searchbox") return true;
      return false;
    }
  }

  const fakeWindow = {
    Element: FakeElement,
    innerWidth: 100,
    innerHeight: 100,
    getComputedStyle(element) {
      return element.styleState;
    }
  };
  return fakeWindow;
}

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height
  };
}

test("detects editable keyboard targets", () => {
  const { Element: FakeElement } = createFakeWindow();
  const textInput = new FakeElement({ tagName: "input", attributes: { type: "text" } });
  const buttonInput = new FakeElement({ tagName: "input", attributes: { type: "button" } });
  const checkboxInput = new FakeElement({ tagName: "input", attributes: { type: "checkbox" } });
  const contentEditable = new FakeElement({ attributes: { contenteditable: "true" } });
  const plainTextEditable = new FakeElement({ attributes: { contenteditable: "plaintext-only" } });
  const disabledEditable = new FakeElement({ attributes: { contenteditable: "false" } });
  const textNode = { nodeType: 3, parentElement: textInput };

  assert.equal(isEditableTarget(textInput), true);
  assert.equal(isEditableTarget(textNode), true);
  assert.equal(isEditableTarget(contentEditable), true);
  assert.equal(isEditableTarget(plainTextEditable), true);
  assert.equal(isEditableTarget(disabledEditable), false);
  assert.equal(isEditableTarget(buttonInput), false);
  assert.equal(isEditableTarget(checkboxInput), false);
});

test("detects editable targets retargeted through shadow DOM events", () => {
  const { Element: FakeElement } = createFakeWindow();
  const host = new FakeElement();
  const shadowInput = new FakeElement({ tagName: "input", attributes: { type: "text" } });
  const event = {
    target: host,
    composedPath: () => [shadowInput, host]
  };

  assert.equal(isEditableTarget(host), false);
  assert.equal(isEditableEventTarget(event), true);
});

test("detects focused editable controls inside open shadow roots", () => {
  const { Element: FakeElement } = createFakeWindow();
  const shadowInput = new FakeElement({ tagName: "input", attributes: { type: "text" } });
  const host = new FakeElement({ shadowRoot: { activeElement: shadowInput } });

  assert.equal(isEditableTarget(host), true);
});

test("filters visible candidates using geometry and computed style", () => {
  const { Element: FakeElement } = createFakeWindow();
  const visible = new FakeElement({ rects: [rect(10, 10, 20, 20)] });
  const hidden = new FakeElement({ rects: [rect(10, 10, 20, 20)], styleState: { visibility: "hidden" } });
  const outside = new FakeElement({ rects: [rect(120, 10, 20, 20)] });

  assert.equal(isVisibleCandidate(visible), true);
  assert.equal(isVisibleCandidate(hidden), false);
  assert.equal(isVisibleCandidate(outside), false);
});

test("creates stable marker points and sorted candidate lists", () => {
  const { Element: FakeElement } = createFakeWindow();
  const later = new FakeElement({ rects: [rect(10, 50, 20, 20)] });
  const first = new FakeElement({ rects: [rect(5, 5, 20, 20)] });
  const root = { querySelectorAll: () => [later, first] };

  assert.deepEqual(markerPoint(first), { x: 15, y: 15, top: 5, left: 5 });
  assert.deepEqual(collectVisibleCandidates("button", { root }).map((candidate) => candidate.element), [first, later]);
});
