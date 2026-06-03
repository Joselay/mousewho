const test = require("node:test");
const assert = require("node:assert/strict");
const { createHintLabels, filterHintIndexes, labelLength } = require("../src/hints.js");

test("creates compact one-key labels when possible", () => {
  assert.deepEqual(createHintLabels(4, "ab"), ["aa", "ab", "ba", "bb"]);
  assert.deepEqual(createHintLabels(3, "abc"), ["a", "b", "c"]);
});

test("increases label length only when capacity requires it", () => {
  assert.equal(labelLength(0, 26), 0);
  assert.equal(labelLength(26, 26), 1);
  assert.equal(labelLength(27, 26), 2);
  assert.equal(labelLength(26 * 26, 26), 2);
  assert.equal(labelLength(26 * 26 + 1, 26), 3);
});

test("labels are deterministic and unique", () => {
  const labels = createHintLabels(1000);
  assert.equal(new Set(labels).size, labels.length);
  assert.deepEqual(labels.slice(0, 5), ["aaa", "aas", "aad", "aaf", "aag"]);
});

test("filters hint indexes by prefix", () => {
  const labels = ["aa", "ab", "ba", "bb"];
  assert.deepEqual(filterHintIndexes(labels, "a"), [0, 1]);
  assert.deepEqual(filterHintIndexes(labels, "bb"), [3]);
  assert.deepEqual(filterHintIndexes(labels, "z"), []);
});
