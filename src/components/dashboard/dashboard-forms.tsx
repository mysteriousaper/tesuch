"use client";

import { SanityWatch } from "@/components/import/sanity-watch";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { addCompany, addEmployee, addLeave, loadDemoData, recheckCompany, renameOrg } from "@/app/[locale]/app/actions";
import { ActionForm, inputCls, labelCls } from "./action-form";

export function AddCompanyForm({ locale }: { locale: string }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm action={addCompany.bind(null, locale)} submitLabel={t("add")}>
      <label className={labelCls}>
        {t("companyName")}
        <input name="name" required maxLength={200} className={inputCls} />
      </label>
      <label className={labelCls}>
        {t("taxId")}
        <input name="tax_id" inputMode="numeric" pattern="\d{8}" maxLength={8} placeholder={t("taxIdHint")} className={inputCls} />
      </label>
    </ActionForm>
  );
}

export function LoadDemoButton({ locale }: { locale: string }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm action={loadDemoData.bind(null, locale)} submitLabel={t("loadDemo")} variant="secondary" success={() => t("demoLoaded")} className="flex flex-col gap-2">
      <p className="text-sm text-muted">{t("loadDemoHint")}</p>
    </ActionForm>
  );
}

export function RecheckButton({ locale, companyId }: { locale: string; companyId: string }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm
      action={recheckCompany.bind(null, locale, companyId)}
      submitLabel={t("recheck")}
      variant="secondary"
      success={(n) => t("rechecked", { count: n ?? 0 })}
      className="flex"
    />
  );
}

export function AddEmployeeForm({ locale, companyId, privacy = false }: { locale: string; companyId: string; privacy?: boolean }) {
  const t = useTranslations("dashboard");
  const [fixed, setFixed] = useState(false);
  const optional = <span className="font-normal text-muted"> ({t("fields.optional")})</span>;
  return (
    <ActionForm action={addEmployee.bind(null, locale, companyId)} submitLabel={t("save")} className="grid gap-3 sm:grid-cols-2">
      {privacy ? (
        <label className={`${labelCls} sm:col-span-2`}>
          {t("fields.employeeCode")}
          <input name="employee_code" maxLength={40} autoComplete="off" placeholder={t("fields.employeeCodeAuto")} className={inputCls} />
        </label>
      ) : (
        <label className={`${labelCls} sm:col-span-2`}>
          {t("fields.fullName")}
          <input name="full_name" required maxLength={200} autoComplete="off" className={inputCls} />
        </label>
      )}
      <label className={labelCls}>
        <span>{t("fields.birthDate")}{optional}</span>
        <input name="birth_date" type="date" className={inputCls} />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm font-medium">
        <legend className="mb-1">{t("fields.contractType")}</legend>
        <div className="flex gap-4 font-normal">
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="indefinite" defaultChecked onChange={() => setFixed(false)} /> {t("fields.indefinite")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="fixed_term" onChange={() => setFixed(true)} /> {t("fields.fixedTerm")}
          </label>
        </div>
      </fieldset>
      <label className={labelCls}>
        {t("fields.startDate")}
        <input name="start_date" type="date" required className={inputCls} />
      </label>
      {fixed && (
        <label className={labelCls}>
          {t("fields.endDate")}
          <input name="end_date" type="date" required className={inputCls} />
        </label>
      )}
      <label className={labelCls}>
        <span>{t("fields.probationEnd")}{optional}</span>
        <input name="probation_end" type="date" className={inputCls} />
      </label>
      {fixed && (
        <label className={labelCls}>
          {t("fields.fixedTermGround")}
          <input name="fixed_term_ground" maxLength={300} className={inputCls} />
        </label>
      )}
      <div className="flex flex-col gap-2 text-sm sm:col-span-2">
        {(["six_day_week", "probation_special_case", "hired_by_transfer"] as const).map((name) => (
          <label key={name} className="flex items-center gap-2">
            <input type="checkbox" name={name} className="h-4 w-4" />
            {t(`fields.${({ six_day_week: "sixDayWeek", probation_special_case: "probationSpecial", hired_by_transfer: "hiredByTransfer" } as const)[name]}`)}
          </label>
        ))}
      </div>
      <label className={`${labelCls} sm:col-span-2`}>
        {t("fields.srcRegistered")}
        <select name="src_registered" defaultValue="" className={inputCls}>
          <option value="">{t("fields.srcUnknown")}</option>
          <option value="yes">{t("fields.srcYes")}</option>
          <option value="no">{t("fields.srcNo")}</option>
        </select>
      </label>
      <SanityWatch />
    </ActionForm>
  );
}

export function AddLeaveForm({ locale, companyId, employeeId }: { locale: string; companyId: string; employeeId: string }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm action={addLeave.bind(null, locale, companyId, employeeId)} submitLabel={t("save")} className="grid gap-3 sm:grid-cols-3">
      <label className={labelCls}>
        {t("leaveType")}
        <select name="type" className={inputCls} defaultValue="annual">
          {(["annual", "maternity", "cash_compensation", "other"] as const).map((k) => (
            <option key={k} value={k}>{t(`leaveTypes.${k}`)}</option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        {t("leaveStart")}
        <input name="start_date" type="date" required className={inputCls} />
      </label>
      <label className={labelCls}>
        {t("leaveDays")}
        <input name="days" type="number" min={1} required inputMode="numeric" className={inputCls} />
      </label>
      <SanityWatch />
    </ActionForm>
  );
}

export function RenameOrgForm({ locale, orgId, name }: { locale: string; orgId: string; name: string }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm action={renameOrg.bind(null, locale, orgId)} submitLabel={t("settings.rename")} resetOnSuccess={false}>
      <label className={labelCls}>
        {t("settings.orgName")}
        <input name="name" required maxLength={200} defaultValue={name} className={inputCls} />
      </label>
    </ActionForm>
  );
}
