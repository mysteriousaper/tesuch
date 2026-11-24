"use client";

import { useTranslations } from "next-intl";
import { deleteCompany, updateCompany } from "@/app/[locale]/app/actions";
import { ActionForm, inputCls, labelCls } from "./action-form";

/** Owner-only block on the company page: edit name / tax id, delete with the company name typed as confirmation. */
export function CompanySettings({ locale, companyId, name, taxId }: { locale: string; companyId: string; name: string; taxId: string | null }) {
  const t = useTranslations("dashboard");
  return (
    <details className="glass">
      <summary className="cursor-pointer px-4 py-3 font-semibold">{t("companySettings")}</summary>
      <div className="flex flex-col gap-6 border-t border-line p-4">
        <ActionForm action={updateCompany.bind(null, locale, companyId)} submitLabel={t("save")} resetOnSuccess={false}>
          <label className={labelCls}>
            {t("companyName")}
            <input name="name" required maxLength={200} defaultValue={name} className={inputCls} />
          </label>
          <label className={labelCls}>
            {t("taxId")}
            <input name="tax_id" inputMode="numeric" pattern="\d{8}" maxLength={8} defaultValue={taxId ?? ""} placeholder={t("taxIdHint")} className={inputCls} />
          </label>
        </ActionForm>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="font-semibold text-danger">{t("deleteCompany")}</h3>
          <p className="text-sm text-muted">{t("deleteCompanyWarn")}</p>
          <ActionForm action={deleteCompany.bind(null, locale, companyId)} submitLabel={t("deleteCompanyConfirm")} variant="secondary">
            <label className={labelCls}>
              {t("deleteTypeName", { name })}
              <input name="confirm" required autoComplete="off" className={inputCls} />
            </label>
          </ActionForm>
        </div>
      </div>
    </details>
  );
}
