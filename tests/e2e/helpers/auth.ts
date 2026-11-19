import { expect, type Page } from "@playwright/test";
import { emailOtp, type TestUser } from "./supabase";

/**
 * Signs in through the real login UI with the real one-time code.
 * The "send code" request is stubbed so no email leaves Supabase (avoids the
 * free mailer's hourly limit and bounces to example.com); the code itself comes from
 * the admin API and is verified by Supabase exactly as a user-typed code would be.
 */
/** Signs in through the real login form. `landing` is where the app should send the user (consent gate sends to /consent). */
export async function signInViaUi(page: Page, user: TestUser, locale: "hy" | "ru" | "en" = "en", landing: "app" | "consent" = "app") {
  await page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`/${locale}/login`);
  await page.locator("#email").fill(user.email);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator("#code")).toBeVisible();
  await page.locator("#code").fill(await emailOtp(user.email));
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(`**/${locale}/${landing}`);
  await page.unroute("**/auth/v1/otp**");
}
