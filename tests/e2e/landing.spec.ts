import { expect, test } from "@playwright/test";
import { hasSupabase } from "./helpers/env";
import { trackErrors } from "./helpers/page-checks";
import { admin } from "./helpers/supabase";

test.describe("self-check and lead capture (lane D)", () => {
  test("10 questions → score → advisory issues with sources", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/check");
    for (let n = 1; n <= 10; n++) {
      await expect(page.getByText(`Question ${n} of 10`).first()).toBeVisible();
      await page.getByRole("group").getByRole("button", { name: "Not sure", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Your result" })).toBeVisible();
    const aria = await page.getByRole("img", { name: /^Inspection readiness: \d+\/100$/ }).getAttribute("aria-label");
    const score = Number(/(\d+)\/100$/.exec(aria!)![1]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(100); // "Not sure" counts as risk.

    const issues = page.locator("section[aria-labelledby=issues-title] li");
    expect(await issues.count()).toBeGreaterThan(0);
    await expect(issues.first()).toContainText("Advisory");
    await expect(issues.first().getByRole("link", { name: /arlis\.am/ })).toHaveAttribute("href", /^https:\/\/www\.arlis\.am\//);
    await expect(page.locator("main").getByText(/not legal advice/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("restart returns to question 1", async ({ page }) => {
    await page.goto("/en/check");
    for (let n = 1; n <= 10; n++) await page.getByRole("group").getByRole("button", { name: "Yes", exact: true }).click();
    await page.getByRole("button", { name: "Start again" }).click();
    await expect(page.getByText("Question 1 of 10").first()).toBeVisible();
  });

  test("lead submission stores the lead once and throttles repeats", async ({ page }) => {
    test.skip(!hasSupabase(), "Supabase keys not configured");
    const email = `qa-e-lead-${Date.now()}@example.com`;
    try {
      await page.goto("/en/check");
      for (let n = 1; n <= 10; n++) await page.getByRole("group").getByRole("button", { name: n % 2 ? "Yes" : "No", exact: true }).click();

      await page.locator("#lead-email").fill(email);
      await page.locator("#lead-size").selectOption("firm");
      await page.locator("#lead-role").selectOption("accountant_firm");
      await page.locator("input[name=consent]").check();
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toBeVisible({ timeout: 20_000 });

      const { data } = await admin().from("leads").select("email, locale, score, company_size, role, consent, answers").eq("email", email);
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ email, locale: "en", company_size: "firm", role: "accountant_firm", consent: true });
      expect(Object.keys(data![0].answers as object)).toHaveLength(10);

      // Same address again within 10 minutes → throttled, still one row.
      await page.goto("/en/check");
      for (let n = 1; n <= 10; n++) await page.getByRole("group").getByRole("button", { name: "Yes", exact: true }).click();
      await page.locator("#lead-email").fill(email);
      await page.locator("input[name=consent]").check();
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.locator("p[role=alert]")).toContainText("just submitted");
      const { count } = await admin().from("leads").select("id", { count: "exact", head: true }).eq("email", email);
      expect(count).toBe(1);
    } finally {
      await admin().from("leads").delete().eq("email", email);
    }
  });

  test("leads are not readable or writable directly by anonymous visitors", async ({ request }) => {
    test.skip(!hasSupabase(), "Supabase keys not configured");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const read = await request.get(`${url}/rest/v1/leads?select=*`, { headers: { apikey: key } });
    expect([401, 403, 404]).toContain(read.status());
    const write = await request.post(`${url}/rest/v1/leads`, { headers: { apikey: key, "content-type": "application/json" }, data: { email: "x@example.com", locale: "en", consent: true } });
    expect([401, 403, 404]).toContain(write.status());
    // The RPC validates consent and email.
    const rpc = await request.post(`${url}/rest/v1/rpc/submit_lead`, {
      headers: { apikey: key, "content-type": "application/json" },
      data: { p_email: "not-an-email", p_locale: "en", p_score: 50, p_answers: {}, p_company_size: null, p_role: null, p_consent: true },
    });
    expect(rpc.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("SEO files (lane D)", () => {
  test("owner-first landing: promise, owner home, codes, check-file CTA", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en");
    await expect(page.locator("h1")).toHaveText("Whenever an inspector comes, you’re ready.");
    await expect(page.locator("#home li").filter({ hasText: "Needs attention" })).toBeVisible();
    await expect(page.locator("#home")).toContainText("Inspector is here");
    await expect(page.locator("#how ol > li")).toHaveCount(3);
    await expect(page.locator("#codes")).toContainText("EMP-014");
    await expect(page.locator("#firms")).toBeVisible();
    await expect(page.locator('#hero-title ~ div a[href="/en/check-file"]')).toBeVisible();
    expect(errors, "console errors").toEqual([]);
  });

  test("sitemap.xml lists every public page in every locale with hreflang alternates", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (const l of ["hy", "ru", "en"]) {
      expect(xml).toMatch(new RegExp(`<loc>https://[^<]+/${l}</loc>`));
      expect(xml).toMatch(new RegExp(`<loc>https://[^<]+/${l}/check</loc>`));
      expect(xml).toContain(`hreflang="${l}"`);
    }
    expect(xml).not.toMatch(/\/app|\/themes|\/login|\/api\//);
  });

  test("robots.txt allows the site, blocks app/api/themes, points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toMatch(/User-Agent: \*/i);
    for (const path of ["/api/", "/hy/app", "/ru/app", "/en/app", "/hy/themes"]) expect(txt).toContain(`Disallow: ${path}`);
    expect(txt).toMatch(/Sitemap: https:\/\/\S+\/sitemap\.xml/);
  });

  test("public pages have absolute hreflang alternates and a canonical (D-1)", async ({ page }) => {
    for (const path of ["/hy", "/ru/check"]) {
      await page.goto(path);
      const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) => els.map((e) => [e.getAttribute("hreflang"), e.getAttribute("href")]));
      expect(links.length).toBeGreaterThanOrEqual(3);
      for (const [, href] of links) expect(href).toMatch(/^https:\/\//);
      const suffix = path.replace(/^\/[a-z]{2}/, "");
      for (const l of ["hy", "ru", "en"]) expect(links.find(([h]) => h === l)?.[1]).toMatch(new RegExp(`/${l}${suffix}$`));
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`^https://.+${path}$`));
    }
  });
});
