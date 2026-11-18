import { expect, type Page } from "@playwright/test";

/** Collects console errors and uncaught page errors for the lifetime of the page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page should not scroll horizontally").toBeLessThanOrEqual(clientWidth);
}

export interface A11yIssue {
  rule: string;
  detail: string;
}

/**
 * Lightweight accessibility checks (no extra dependency):
 * exactly one h1, labelled form controls, alt on images, accessible names on buttons/links, html lang.
 */
export async function a11yIssues(page: Page): Promise<A11yIssue[]> {
  return page.evaluate(() => {
    const issues: { rule: string; detail: string }[] = [];
    const name = (el: Element) =>
      (el.getAttribute("aria-label") ?? "").trim() ||
      (el.getAttribute("aria-labelledby") ? document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent?.trim() ?? "" : "") ||
      (el.textContent ?? "").trim() ||
      (el.getAttribute("title") ?? "").trim() ||
      Array.from(el.querySelectorAll("img[alt],svg[aria-label]")).map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label")).join("").trim();
    const visible = (el: Element) => {
      const s = getComputedStyle(el as HTMLElement);
      return s.display !== "none" && s.visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
    };

    if (!document.documentElement.lang) issues.push({ rule: "html-lang", detail: "missing <html lang>" });
    const h1s = Array.from(document.querySelectorAll("h1")).filter(visible);
    if (h1s.length !== 1) issues.push({ rule: "one-h1", detail: `found ${h1s.length} visible h1` });

    for (const el of Array.from(document.querySelectorAll("input:not([type=hidden]),select,textarea")).filter(visible)) {
      const id = el.getAttribute("id");
      const labelled =
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest("label") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby");
      if (!labelled) issues.push({ rule: "label", detail: el.outerHTML.slice(0, 120) });
    }
    for (const img of Array.from(document.querySelectorAll("img"))) {
      if (!img.hasAttribute("alt")) issues.push({ rule: "img-alt", detail: img.outerHTML.slice(0, 120) });
    }
    for (const el of Array.from(document.querySelectorAll("button,a[href],[role=button]")).filter(visible)) {
      if (!name(el)) issues.push({ rule: "accessible-name", detail: el.outerHTML.slice(0, 120) });
    }
    return issues;
  });
}
