import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.0/2.1 A + AA, the standard Tesuch commits to (docs/QUALITY_BAR.md). */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Known, documented violations. Each entry suppresses ONE rule on pages matching `page`
 * Remove the entry when the backlog item (docs/qa/BACKLOG.md) is fixed; keep this list short and honest.
 */
export interface KnownViolation {
  rule: string;
  /** Matches the page pathname. */
  page: RegExp;
  backlog: string;
  note: string;
}

export const KNOWN_VIOLATIONS: KnownViolation[] = [
  {
    rule: "color-contrast",
    page: /^\/(hy|ru|en)\/themes$/,
    backlog: "m-20",
    note: "theme-preview.tsx: small fintech-theme label (3.58:1, text-highlight) and status pill (4.33:1, text-ok) below 4.5:1",
  },
  {
    rule: "color-contrast",
    page: /^\/(hy|ru|en)\/app\/quiz$/,
    backlog: "m-19",
    note: "streak-panel.tsx: locked badges use opacity-50 (3.19:1 title, 2.22:1 caption)",
  },
];

/**
 * Runs axe (WCAG 2a/2aa/21a/21aa) on the current page and fails on any violation
 * that is not in KNOWN_VIOLATIONS. Suppressed hits are attached to the test as an
 * annotation so every remaining violation stays visible in the report.
 */
export async function expectNoAxeViolations(page: Page, info?: { annotations: { type: string; description?: string }[] }) {
  const path = new URL(page.url()).pathname;
  // Streamed pages can still have an empty <title> right after load (metadata resolves late).
  await expect(page).toHaveTitle(/\S/);
  // Scroll-reveal/intro animations would otherwise be measured mid-fade (opacity < 1 reads as 1:1 contrast).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const suppressed: string[] = [];
  const failing = results.violations.filter((v) => {
    const known = KNOWN_VIOLATIONS.find((k) => k.rule === v.id && k.page.test(path));
    if (known) suppressed.push(`${v.id} @ ${path} (${known.backlog}, ${v.nodes.length} nodes)`);
    return !known;
  });
  for (const s of suppressed) info?.annotations.push({ type: "axe-suppressed", description: s });
  expect(
    failing.map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`.slice(0, 220)),
    })),
    `axe violations on ${path}`,
  ).toEqual([]);
}
