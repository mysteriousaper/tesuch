import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { seedDocsFixture, type DocsFixture } from "./helpers/lane-c";
import { expectNoHorizontalScroll } from "./helpers/page-checks";
import { createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

// Design review screenshots (decision #25). Only runs with SHOTS=1; writes docs/design/screenshots/.
const OUT = "docs/design/screenshots";
const VIEWS = [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "mobile", size: { width: 360, height: 740 } },
] as const;
const SCHEMES = ["light", "dark"] as const;

test.describe("screenshots", () => {
  test.skip(!process.env.SHOTS || !hasSupabase(), "set SHOTS=1 and Supabase keys");
  test.setTimeout(240_000);
  let user: TestUser;
  let fx: DocsFixture;
  test.beforeAll(async () => {
    user = await createTestUser("shots");
    fx = await seedDocsFixture(user, "Shots");
    mkdirSync(OUT, { recursive: true });
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  for (const view of VIEWS) {
    for (const scheme of SCHEMES) {
      test(`${view.name} ${scheme}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: view.size, colorScheme: scheme, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const shot = async (name: string, path: string) => {
          await page.goto(path);
          await page.waitForTimeout(900);
          try { await expectNoHorizontalScroll(page); } catch (e) { throw new Error(`${path}: ${(e as Error).message}`); }
          await page.screenshot({ path: `${OUT}/${name}-${view.name}-${scheme}.png`, fullPage: false });
        };
        for (const [n, p] of [["landing", "/hy"], ["login", "/hy/login"], ["check", "/hy/check"], ["security", "/hy/security"], ["privacy", "/hy/privacy"]] as const) await shot(n, p);
        await signInViaUi(page, user, "hy");
        for (const [n, p] of [
          ["home", "/hy/app"], ["company", `/hy/app/companies/${fx.companyId}`], ["inbox", "/hy/app/inbox"], ["import", "/hy/app/import"],
          ["documents", "/hy/app/documents"], ["quiz", "/hy/app/quiz"], ["team", "/hy/app/members"], ["settings", "/hy/app/settings"],
        ] as const) await shot(n, p);
        expect(true).toBe(true);
        await ctx.close();
      });
    }
  }
});
