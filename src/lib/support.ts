// Support contact for the app shell. Shown only when NEXT_PUBLIC_SUPPORT_EMAIL is a valid address.
// NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (optional) adds the Telegram bot; both are public by nature.
import { z } from "zod";

export interface SupportLinks {
  email: string;
  mailto: string;
  /** https://t.me/<bot> or null when no (valid) bot name is configured. */
  telegram: string | null;
}

const BOT = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/;

export function supportLinks(emailRaw: string | undefined, botRaw?: string): SupportLinks | null {
  const email = z.string().trim().email().max(254).safeParse(emailRaw ?? "");
  if (!email.success) return null;
  const bot = BOT.exec((botRaw ?? "").trim());
  return { email: email.data, mailto: `mailto:${email.data}`, telegram: bot ? `https://t.me/${bot[1]}` : null };
}
