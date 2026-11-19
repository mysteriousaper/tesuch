// Probe 4: hostile names (HTML, RTL override, zero-width, max length, astral chars) through pages, PDFs and exports.
import { APP, cleanup, cookieFor, createUser, report, signIn } from "./lib.mjs";

const NAMES = [
  `<script>alert(1)</script><img src=x onerror=alert(2)>`,
  `Ann‮gpj.exe‬ a`, // RTL override
  `=HYPERLINK("http://evil.example","x")`, // spreadsheet formula
  `Զ`.repeat(200), // max length, Armenian
  `😀𝔘​\u0000`.slice(0, 5), // astral + zero-width (+ NUL)
];

try {
  const u = await createUser("input");
  const s = await signIn(u);
  const db = s.client;
  const cookie = cookieFor(s.session);
  const { data: org } = await db.rpc("create_org", { p_name: NAMES[0] });
  const { data: co } = await db.from("companies").insert({ org_id: org, name: NAMES[1] }).select("id").single();
  for (const name of NAMES) {
    const { data: emp, error } = await db.from("employees").insert({ org_id: org, company_id: co.id, full_name: name }).select("id").single();
    if (error) { report(`store name ${JSON.stringify(name.slice(0, 30))}`, true, `rejected: ${error.message}`); continue; }
    const { data: ct } = await db.from("contracts").insert({ org_id: org, employee_id: emp.id, type: "fixed_term", start_date: "2026-01-01", end_date: "2026-12-31", probation_end: "2026-02-01" }).select("id").single();
    const res = await Promise.all([
      fetch(`${APP}/api/pdf/probation?contract=${ct.id}`, { headers: { cookie } }),
      fetch(`${APP}/api/pdf/dismissal?contract=${ct.id}&date=2026-06-01`, { headers: { cookie } }),
      fetch(`${APP}/en/app/members/data/employees/${emp.id}`, { headers: { cookie } }),
    ]);
    report(`PDFs + export for ${JSON.stringify(name.slice(0, 30))}`, res.every((r) => r.status === 200), res.map((r) => `${r.status} ${r.headers.get("content-disposition") ?? ""}`).join(" | "));
  }
  const page = await (await fetch(`${APP}/en/app/companies/${co.id}`, { headers: { cookie: `${cookie}; tesuch_org=${org}` } })).text();
  report("company page escapes <script> names", !page.includes("<script>alert(1)</script>"), `raw tag present: ${page.includes("<script>alert(1)</script>")}`);
  const cl = await fetch(`${APP}/api/pdf/checklist?company=${co.id}`, { headers: { cookie } });
  report("checklist PDF with hostile org/company names", cl.status === 200, `${cl.status}`);
} finally {
  await cleanup();
}
