import { test } from "@playwright/test";

// Placeholders for features other arena lanes are building in parallel.
// Enable each block (remove .fixme and fill in) when the lane merges.

test.describe("dashboard (lane A)", () => {
  // TODO(lane A): companies sorted by score, company page, employee timeline, fix/dismiss a finding, re-check now.
  test.fixme("firm dashboard lists companies sorted by score", async () => {});
  test.fixme("marking a finding fixed updates the score", async () => {});
});

test.describe("documents and quiz (lane C)", () => {
  // TODO(lane C): download each PDF (status 200, %PDF, Armenian font embedded); answer weekly quiz, streak/badge shown.
  test.fixme("probation order PDF downloads", async () => {});
  test.fixme("weekly quiz can be answered once per week", async () => {});
});

test.describe("landing and self-check (lane D)", () => {
  // TODO(lane D): /hy/check 10 questions → score → email capture stored; sitemap.xml and robots.txt.
  test.fixme("self-check gives a score and captures a lead", async () => {});
  test.fixme("sitemap.xml lists all locales", async () => {});
});
