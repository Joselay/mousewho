"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist", "firefox");

const COPIES = [
  ["manifest.firefox.json", "manifest.json"],
  ["src", "src"],
  ["icons", "icons"]
];

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [source, target] of COPIES) {
  fs.cpSync(path.join(ROOT, source), path.join(OUT_DIR, target), { recursive: true });
}

console.log(`Built Firefox extension in ${path.relative(ROOT, OUT_DIR)}`);
