import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { trackErrors } from "./helpers/page-checks";
import { createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

// The help link only exists when the server runs with NEXT_PUBLIC_SUPPORT_EMAIL; both cases are checked.
test.describe("support link (R15)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  let user: TestUser;
  test.beforeAll(async () => { user = await createTestUser("support"); });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("Help footer with mailto, Telegram and the response promise, only when configured", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
    if (!configured) {
      await expect(page.getByTestId("help-link")).toHaveCount(0);
      await expect(page.getByTestId("support-footer")).toHaveCount(0);
      return;
    }
    await expect(page.getByTestId("help-link")).toHaveText("Help");
    const footer = page.getByTestId("support-footer");
    await expect(footer).toContainText("We answer within 1 working day.");
    await expect(footer.getByRole("link", { name: process.env.NEXT_PUBLIC_SUPPORT_EMAIL! })).toHaveAttribute("href", `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`);
    if (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) {
      await expect(footer.getByRole("link", { name: "Telegram bot" })).toHaveAttribute("href", `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`);
    }
    expect(errors, "console errors").toEqual([]);
  });
});
