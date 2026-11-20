import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Finding } from "../rules/types";
import { noticePlan } from "./notice";
import { renderChecklist, renderDismissalNotice, renderFixedTermEndNotice, renderProbationOrder } from "./render";

const company = { name: "«Դեմո Սոֆթ» ՍՊԸ", taxId: "02612345", directorName: "Directorian D." };
const employee = { name: "Արամ Պետրոսյան", position: "Հաշվապահ" };
const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";

// Optional: set PDF_SAMPLE_DIR to write samples for visual inspection.
const sampleDir = process.env.PDF_SAMPLE_DIR;
const save = (name: string, b: Buffer) => {
  if (!sampleDir) return;
  mkdirSync(sampleDir, { recursive: true });
  writeFileSync(`${sampleDir}/${name}`, b);
};

const finding = (o: Partial<Finding>): Finding => ({
  ruleId: "probation-max", ruleVersion: 1, article: "92", sourceUrl: "https://www.arlis.am/",
  ruleStatus: "needs_lawyer_review", severity: "advisory", companyId: "co1", employeeId: "e1",
  contractId: "c1", dueDate: "2026-04-15", overdue: false, ...o,
});

describe("notice plan (thresholds from rules/notice-period.json)", () => {
  it("uses the tier for length of service", () => {
    expect(noticePlan("2026-01-01", "2026-06-01", false)).toMatchObject({ period: { days: 14 }, earliestTermination: "2026-06-15" });
    expect(noticePlan("2020-06-01", "2026-06-01", false)).toMatchObject({ period: { days: 42 }, serviceYears: 6 });
    expect(noticePlan("2005-01-01", "2026-06-01", false)).toMatchObject({ period: { days: 60 } });
  });
  it("uses 2 months for workforce reduction", () => {
    expect(noticePlan("2024-01-01", "2026-11-30", true)).toMatchObject({ period: { months: 2 }, earliestTermination: "2027-01-30" });
  });
});

describe("PDF rendering", { timeout: 60_000 }, () => {
  it("renders the probation confirmation order", async () => {
    const b = await renderProbationOrder({ company, employee, contractStart: "2026-01-15", probationEnd: "2026-04-14", decision: "confirm", orderNo: "12", orderDate: "2026-04-10" });
    expect(isPdf(b)).toBe(true);
    save("probation-confirm.pdf", b);
  });
  it("renders the probation termination order with placeholders", async () => {
    const b = await renderProbationOrder({ company: { name: "Test LLC" }, employee: { name: "Test" }, contractStart: "2026-01-15", probationEnd: "2026-04-14", decision: "terminate" });
    expect(isPdf(b)).toBe(true);
  });
  it("renders the fixed-term end notice", async () => {
    const b = await renderFixedTermEndNotice({ company, employee, contractStart: "2025-12-01", contractEnd: "2026-12-31", noticeDate: "2026-12-01" });
    expect(isPdf(b)).toBe(true);
    save("fixed-term-end.pdf", b);
  });
  it("renders the dismissal notice, including the too-early warning", async () => {
    const b = await renderDismissalNotice({ company, employee, serviceStart: "2019-03-01", noticeDate: "2026-11-18", terminationDate: "2026-12-01", ground: "Աշխատողների թվաքանակի կրճատում", workforceReduction: true });
    expect(isPdf(b)).toBe(true);
    save("dismissal-notice.pdf", b);
  });
  it.each(["hy", "ru", "en"] as const)("renders the checklist in %s", async (locale) => {
    const items = [
      { finding: finding({ overdue: true }), employeeName: "Արամ Պետրոսյան" },
      { finding: finding({ ruleId: "notice-period", article: null, employeeId: "e2" }), employeeName: "Анна Иванова" },
      { finding: finding({ ruleId: "src-registration", article: null, employeeId: "e3" }), employeeName: "Test Employee" },
    ];
    const b = await renderChecklist({ locale, company, asOf: "2026-11-18", score: 72, items });
    expect(isPdf(b)).toBe(true);
    save(`checklist-${locale}.pdf`, b);
  });
  it("renders a checklist without a score (no staff yet)", async () => {
    expect(isPdf(await renderChecklist({ locale: "en", company, asOf: "2026-11-18", score: null, items: [] }))).toBe(true);
  });
  it("renders an empty checklist", async () => {
    expect(isPdf(await renderChecklist({ locale: "hy", company, asOf: "2026-11-18", score: 100, items: [] }))).toBe(true);
  });
});
