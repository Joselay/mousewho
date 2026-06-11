const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const chromeManifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const firefoxManifest = JSON.parse(fs.readFileSync("manifest.firefox.json", "utf8"));
const CONTENT_SCRIPTS = ["src/hints.js", "src/dom.js", "src/content.js"];

test("Chrome manifest defines a no-build MV3 extension", () => {
  assert.equal(chromeManifest.manifest_version, 3);
  assert.equal(chromeManifest.background.service_worker, "src/background.js");
  assert.deepEqual(chromeManifest.content_scripts[0].js, CONTENT_SCRIPTS);
  assert.equal(chromeManifest.content_scripts[0].run_at, "document_start");
});

test("Firefox manifest uses the shared scripts with a Firefox background", () => {
  assert.equal(firefoxManifest.manifest_version, 3);
  assert.deepEqual(firefoxManifest.background.scripts, ["src/background.js"]);
  assert.equal(firefoxManifest.background.service_worker, undefined);
  assert.equal(firefoxManifest.minimum_chrome_version, undefined);
  assert.deepEqual(firefoxManifest.content_scripts[0].js, CONTENT_SCRIPTS);
  assert.equal(firefoxManifest.content_scripts[0].run_at, "document_start");
});
