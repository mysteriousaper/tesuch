"use client";

import { useTranslations } from "next-intl";
import { setPrivacyMode } from "@/app/[locale]/app/settings/actions";
import { ActionForm } from "./action-form";

/** Owner-only switch for "code instead of name". The page only renders it for owners; the action and the database check again. */
export function PrivacyModeForm({ locale, enabled }: { locale: string; enabled: boolean }) {
  const t = useTranslations("dashboard");
  return (
    <ActionForm action={setPrivacyMode.bind(null, locale)} submitLabel={t("settings.privacy.save")} resetOnSuccess={false}>
      <label className="flex items-start gap-3 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{t("settings.privacy.toggle")}</span>
      </label>
    </ActionForm>
  );
}
