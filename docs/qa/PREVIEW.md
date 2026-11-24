# Preview deployments

Preview only (`vercel deploy`, never `--prod`). Previews sit behind Vercel Authentication: open them while signed in to the Vercel account, or use a "Share" link from the Vercel dashboard.

| Build | Branch / commit | URL |
|---|---|---|
| Glass redesign v2, reference shell (rules2 + majors merged, 4 migrations applied to the real DB) | `claude/redesign` @ the commit after 9a75ef3 (headers for inbox, team, documents, quiz, import, settings) | https://tesuch-5fak9rcb8-samvel-hovsepyan-4774.vercel.app (gray, latest) |
| Redesign v2 brown (superseded) | earlier commit | https://tesuch-cizv17nwb-samvel-hovsepyan-4774.vercel.app |
| Glass redesign v1 (superseded) | earlier commit | https://tesuch-kt63cn2zn-samvel-hovsepyan-4774.vercel.app |


The pre-redesign (Phase 1 only) preview was not deployed separately; the redesign build contains all Phase 1 changes.
Screenshots: `docs/design/screenshots/`.
