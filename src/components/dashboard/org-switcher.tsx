"use client";

import { useTranslations } from "next-intl";
import { switchOrg } from "@/app/[locale]/app/actions";

/** Firm picker for users in several firms. Submits on change; the button keeps it usable without JS. */
export function OrgSwitcher({ locale, orgs, current }: { locale: string; orgs: { id: string; name: string }[]; current: string }) {
  const t = useTranslations("dashboard.org");
  if (orgs.length < 2) return null;
  return (
    // key: remount after a switch so the uncontrolled select shows the new current org.
    <form key={current} action={switchOrg.bind(null, locale)} className="flex items-center gap-2">
      <label htmlFor="org-switch" className="text-sm text-muted">{t("label")}</label>
      <select
        id="org-switch"
        name="org_id"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-[16rem] rounded-full border border-control bg-surface px-3 py-2 text-sm"
      >
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <noscript>
        <button className="rounded-full border border-control px-3 py-2 text-sm">{t("switch")}</button>
      </noscript>
    </form>
  );
}
