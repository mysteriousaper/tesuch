/** Joins class names, skipping falsy values (shadcn `cn` without extra dependencies). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
