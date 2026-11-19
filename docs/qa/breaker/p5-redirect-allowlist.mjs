// Probe 5: does Supabase Auth accept a redirect to a Vercel domain anyone can register?
// Uses admin generateLink (returns the link, sends NO email) for a throwaway user.
import { admin, cleanup, createUser, report } from "./lib.mjs";

try {
  const u = await createUser("redir", { consent: false });
  const targets = [
    "https://tesuch-anyone-samvel-hovsepyan-4774.vercel.app/steal", // a Vercel *project name* an outsider can pick
    "https://evil.example/steal", // control: not on the allow list
  ];
  for (const redirectTo of targets) {
    for (const type of ["recovery", "magiclink"]) {
      const { data, error } = await admin().auth.admin.generateLink({ type, email: u.email, options: { redirectTo } });
      if (error) { console.log(type, redirectTo, error.message); continue; }
      const got = new URL(data.properties.action_link).searchParams.get("redirect_to");
      const accepted = got === redirectTo;
      report(`${type} link redirect_to=${new URL(redirectTo).host}`, !accepted, `action_link redirect_to=${got}`);
    }
  }
} finally {
  await cleanup();
}
