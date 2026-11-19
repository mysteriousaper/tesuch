/** Today's calendar date in Armenia (YYYY-MM-DD), whatever timezone the server runs in (Vercel: UTC). */
export function yerevanToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yerevan", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
