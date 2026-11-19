"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { MembersState } from "@/app/[locale]/app/members/actions";
import { ROLES, type Role } from "./lib";

type Action = (prev: MembersState, form: FormData) => Promise<MembersState>;

export const inputCls = "w-full rounded-theme border border-line bg-surface px-3 py-2.5 text-base text-ink";
export const primaryBtn = "rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60";
export const secondaryBtn = "rounded-theme border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-60";
export const dangerBtn = "rounded-theme border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-60";

function Status({ state, success }: { state: MembersState; success?: string }) {
  const t = useTranslations("members");
  return (
    <p role="status" aria-live="polite" className="text-sm empty:hidden">
      {state?.ok && success && <span className="text-ok">{success}</span>}
      {state && !state.ok && <span className="text-danger">{t(`errors.${state.error}`)}</span>}
    </p>
  );
}

export function CopyLink({ link }: { link: string }) {
  const t = useTranslations("members");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={link} aria-label={t("invite.link")} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 font-mono text-xs`} data-testid="invite-link" />
      <button
        type="button"
        className={secondaryBtn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t("invite.copied") : t("invite.copy")}
      </button>
    </div>
  );
}

export function InviteForm({ action }: { action: Action }) {
  const t = useTranslations("members");
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <div className="flex flex-col gap-3">
      <form ref={ref} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-busy={pending}>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {t("invite.email")}
          <input name="email" type="email" required maxLength={320} autoComplete="off" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("invite.role")}
          <select name="role" defaultValue="accountant" className={inputCls}>
            {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? "…" : t("invite.send")}</button>
      </form>
      <Status state={state} />
      {state?.ok && state.link && (
        <div className="flex flex-col gap-2 rounded-theme border border-line bg-surface-2 p-3 text-sm">
          <p className="text-ok">{state.emailed ? t("invite.emailed", { email: state.email ?? "" }) : t("invite.notEmailed")}</p>
          <CopyLink link={state.link} />
        </div>
      )}
    </div>
  );
}

export function RoleForm({ action, userId, role, label }: { action: Action; userId: string; role: Role; label: string }) {
  const t = useTranslations("members");
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <input type="hidden" name="user_id" value={userId} />
      <select name="role" defaultValue={role} aria-label={label} className="rounded-theme border border-line bg-surface px-2 py-2 text-sm">
        {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
      </select>
      <button type="submit" disabled={pending} className={secondaryBtn}>{pending ? "…" : t("members.saveRole")}</button>
      <Status state={state} success={t("members.saved")} />
    </form>
  );
}

/** A button that opens a modal confirmation; the server action only runs from inside the dialog. */
export function ConfirmForm({
  action, fields, trigger, title, body, confirm, triggerLabel,
}: {
  action: Action;
  fields: Record<string, string>;
  trigger: string;
  title: string;
  body: string;
  confirm: string;
  /** Accessible name for the trigger when its visible text is generic (e.g. "Remove"). */
  triggerLabel?: string;
}) {
  const t = useTranslations("members");
  const [state, formAction, pending] = useActionState(action, null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (state) dialog.current?.close();
  }, [state]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={dangerBtn} aria-label={triggerLabel} onClick={() => dialog.current?.showModal()}>{trigger}</button>
      <Status state={state} />
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-theme-lg border border-line bg-surface p-5 text-ink backdrop:bg-black/50">
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted">{body}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => dialog.current?.close()}>{t("cancel")}</button>
            <button type="submit" disabled={pending} className="rounded-theme bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "…" : confirm}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
