import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/companies/cb6f5570-118e-430e-b4c9-227160491f9a/employees/0207454f-c91b-448f-b0c6-a534a3ea4008"); await page.waitForTimeout(1500);
    const forms = page.locator("main form"); console.log("forms", await forms.count());
    const f = forms.first();
    const inputs = await f.locator("input,select,textarea").evaluateAll(a=>a.map((x:any)=>x.name+":"+x.type));
    console.log(inputs);
    await f.locator('input[name=probation_end]').fill("2025-11-17").catch(e=>console.log("pe",e.message.slice(0,80)));
    await f.locator('input[name=fixed_term_ground]').fill("Սեզոնային աշխատանք").catch(e=>console.log("g",e.message.slice(0,80)));
    await f.locator('input[name=src_registered]').check().catch(e=>console.log("s",e.message.slice(0,80)));
    await f.locator("button[type=submit]").click(); await page.waitForTimeout(3000);
    console.log("status:", await f.locator("[role=status]").innerText());
    console.log((await text(page,1200)).split("\n").slice(12,40).join(" | "));
    await shot(page,"13-employee-after-edit-hy");
    // leave
    const lf = forms.nth(1);
    await lf.locator("input[type=date]").fill("2026-01-10"); await lf.locator("input[type=number]").fill("20");
    await lf.locator("button[type=submit]").click(); await page.waitForTimeout(2500);
    console.log("leave status:", await lf.locator("[role=status]").innerText());
    await page.goto("/hy/app/companies/cb6f5570-118e-430e-b4c9-227160491f9a");await page.waitForTimeout(1500);
    await page.getByRole("button",{name:"Ստուգել հիմա"}).click(); await page.waitForTimeout(8000);
    await page.goto("/hy/app/companies/cb6f5570-118e-430e-b4c9-227160491f9a/employees/0207454f-c91b-448f-b0c6-a534a3ea4008"); await page.waitForTimeout(1500);
    console.log("TL:", (await text(page,1500)).split("\n").slice(13,35).join(" | "));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
