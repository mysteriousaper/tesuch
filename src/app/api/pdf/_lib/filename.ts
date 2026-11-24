/** "Name Surname" → "name-surname" (letters of any script, digits; at most 40 characters). */
export function nameSlug(label: string): string {
  return label.normalize("NFC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

/**
 * Content-Disposition for a PDF download. `filename` stays ASCII (short id) for old clients;
 * `filename*` carries the employee's name when there is one, so the saved file is easy to find.
 */
export function pdfDisposition(kind: string, id: string, date: string, label?: string): string {
  const ascii = `tesuch-${kind}-${id.slice(0, 8)}-${date}.pdf`.replace(/[^A-Za-z0-9._-]/g, "");
  const slug = label ? nameSlug(label) : "";
  if (!slug) return `attachment; filename="${ascii}"`;
  const full = `tesuch-${kind}-${slug}-${date}.pdf`.replace(/[^\p{L}\p{N}._-]/gu, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(full)}`;
}
