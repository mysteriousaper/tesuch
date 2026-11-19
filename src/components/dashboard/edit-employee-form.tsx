"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { updateEmployee } from "@/app/[locale]/app/actions";
import { ActionForm, inputCls, labelCls } from "./action-form";

export interface EmployeeValues {
  full_name: string;
  birth_date: string | null;
  six_day_week: boolean;
  type: "indefinite" | "fixed_term";
  start_date: string;
  end_date: string | null;
  probation_end: string | null;
  probation_special_case: boolean;
  hired_by_transfer: boolean;
  fixed_term_ground: string | null;
  src_registered: boolean;
  terminated_on: string | null;
  termination_ground: string | null;
  termination_initiator: "employer" | "employee" | "mutual" | null;
  notice_given_on: string | null;
  workforce_reduction: boolean;
}

const FLAG_LABEL = { six_day_week: "sixDayWeek", probation_special_case: "probationSpecial", hired_by_transfer: "hiredByTransfer", src_registered: "srcRegistered" } as const;

/** Edit employee + contract. Saving re-runs the rules, so corrected data closes its findings. */
export function EditEmployeeForm({ locale, companyId, employeeId, contractId, values }: {
  locale: string; companyId: string; employeeId: string; contractId: string; values: EmployeeValues;
}) {
  const t = useTranslations("dashboard");
  const [fixed, setFixed] = useState(values.type === "fixed_term");
  const optional = <span className="font-normal text-muted"> ({t("fields.optional")})</span>;
  const date = (name: keyof EmployeeValues, label: React.ReactNode, required = false) => (
    <label className={labelCls}>
      <span>{label}</span>
      <input name={name} type="date" required={required} defaultValue={(values[name] as string | null) ?? ""} className={inputCls} />
    </label>
  );

  return (
    <ActionForm
      action={updateEmployee.bind(null, locale, companyId, employeeId, contractId)}
      submitLabel={t("save")}
      resetOnSuccess={false}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className={`${labelCls} sm:col-span-2`}>
        {t("fields.fullName")}
        <input name="full_name" required maxLength={200} defaultValue={values.full_name} className={inputCls} />
      </label>
      {date("birth_date", <>{t("fields.birthDate")}{optional}</>)}
      <fieldset className="flex flex-col gap-1 text-sm font-medium">
        <legend className="mb-1">{t("fields.contractType")}</legend>
        <div className="flex gap-4 font-normal">
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="indefinite" defaultChecked={!fixed} onChange={() => setFixed(false)} /> {t("fields.indefinite")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="fixed_term" defaultChecked={fixed} onChange={() => setFixed(true)} /> {t("fields.fixedTerm")}
          </label>
        </div>
      </fieldset>
      {date("start_date", t("fields.startDate"), true)}
      {fixed && date("end_date", t("fields.endDate"), true)}
      {date("probation_end", <>{t("fields.probationEnd")}{optional}</>)}
      {fixed && (
        <label className={labelCls}>
          {t("fields.fixedTermGround")}
          <input name="fixed_term_ground" maxLength={300} defaultValue={values.fixed_term_ground ?? ""} className={inputCls} />
        </label>
      )}
      <div className="flex flex-col gap-2 text-sm sm:col-span-2">
        {(Object.keys(FLAG_LABEL) as (keyof typeof FLAG_LABEL)[]).map((name) => (
          <label key={name} className="flex items-center gap-2">
            <input type="checkbox" name={name} defaultChecked={values[name]} className="h-4 w-4" />
            {t(`fields.${FLAG_LABEL[name]}`)}
          </label>
        ))}
      </div>
      <details className="rounded-theme border border-line sm:col-span-2" open={Boolean(values.terminated_on)}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{t("termination")}</summary>
        <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
          {date("terminated_on", t("fields2.terminatedOn"))}
          {date("notice_given_on", t("fields2.noticeGivenOn"))}
          <label className={labelCls}>
            {t("fields2.terminationInitiator")}
            <select name="termination_initiator" defaultValue={values.termination_initiator ?? ""} className={inputCls}>
              <option value="">{t("fields2.none")}</option>
              {(["employer", "employee", "mutual"] as const).map((k) => <option key={k} value={k}>{t(`fields2.initiators.${k}`)}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            {t("fields2.terminationGround")}
            <input name="termination_ground" maxLength={300} defaultValue={values.termination_ground ?? ""} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="workforce_reduction" defaultChecked={values.workforce_reduction} className="h-4 w-4" />
            {t("fields2.workforceReduction")}
          </label>
        </div>
      </details>
    </ActionForm>
  );
}
