const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

test("manifest defines a no-build MV3 Chrome extension", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(manifest.content_scripts[0].js, ["src/hints.js", "src/content.js"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
});
