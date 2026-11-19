import { session, shot, text } from "./lib";
(async () => {
  const { browser, page } = await session("hy");
  try {
    const C="cb6f5570-118e-430e-b4c9-227160491f9a";
    await page.goto(`/hy/app/documents?company=${C}`); await page.waitForTimeout(2000);
    const t = await page.locator("main").innerText();
    console.log("employees listed:", (t.match(/Պայմանագիր \d/g)||[]).length, "has Khachatryan:", t.includes("Խաչատրյան Դավիթ Սամվելի"));
    const i = t.indexOf("Խաչատրյան Դավիթ Սամվելի"); console.log(t.slice(i, i+400));
  } finally { await browser.close(); }
})();
