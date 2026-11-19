import { telegramAlert, telegramDigest, emailAlert, emailDigest, type AlertItem } from "../../../src/lib/notify/messages";
const mk = (ruleId: string, article: string | null, days: number, overdue = false, name = "Գևորգ Պետրոսյան"): AlertItem => ({
  companyName: "Կարեն Ավտո ՍՊԸ", employeeName: name,
  finding: { ruleId, ruleVersion: 1, article, sourceUrl: "https://www.arlis.am/", ruleStatus: "needs_lawyer_review", severity: "advisory", companyId: "c", employeeId: "e", contractId: null, dueDate: new Date(Date.now() + days * 864e5).toISOString().slice(0, 10), overdue },
});
const items = [mk("probation-max", "92", 0), mk("fixed-term-ending", "95", 12), mk("src-registration", null, 3, true, "Մարիամ Ավետիսյան")];
for (const l of ["hy", "ru", "en"] as const) {
  console.log(`\n===== ${l} TELEGRAM ALERT =====\n` + telegramAlert(items[1], l));
  console.log(`\n===== ${l} TELEGRAM DIGEST =====\n` + telegramDigest([{ companyName: "Կարեն Ավտո ՍՊԸ", score: 88, items }], l));
}
const e = emailAlert(items[2], "hy"); console.log("\n===== hy EMAIL ALERT =====\n" + e.subject + "\n" + e.text);
const d = emailDigest([{ companyName: "Կարեն Ավտո ՍՊԸ", score: 88, items }], "ru"); console.log("\n===== ru EMAIL DIGEST =====\n" + d.subject + "\n" + d.text);
console.log("links in html:", [...d.html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]));
