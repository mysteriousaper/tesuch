export type Role = "owner" | "accountant" | "viewer";

export interface OrgInfo { id: string; name: string; locale: string; role: Role }

/**
 * Which org the user works in: the cookie's org only if the user is a member of it, else their first org.
 * The cookie is a preference, never an authorisation.
 */
export function pickOrg(orgs: OrgInfo[], preferred: string | undefined): OrgInfo | null {
  return orgs.find((o) => o.id === preferred) ?? orgs[0] ?? null;
}
