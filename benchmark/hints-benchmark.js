#!/usr/bin/env node
"use strict";

const { performance } = require("node:perf_hooks");
const { createHintLabels, filterHintIndexes } = require("../src/hints.js");

function time(name, iterations, fn) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  console.log(`${name}: median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms`);
  return { median, p95 };
}

const hintCount = Number(process.env.HINT_COUNT || 5000);
let labels = [];

console.log(`Mousewho hint benchmark (${hintCount} synthetic hints)`);
time("label generation", 50, () => {
  labels = createHintLabels(hintCount);
});

time("prefix filter (1 char)", 100, () => {
  filterHintIndexes(labels, labels[0][0]);
});

time("prefix filter (2 chars)", 100, () => {
  filterHintIndexes(labels, labels[0].slice(0, 2));
});

console.log("Tip: run with HINT_COUNT=10000 node benchmark/hints-benchmark.js for stress testing.");
