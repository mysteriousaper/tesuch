# Preview deployments

Preview deploys (`vercel deploy`, never `--prod`) were **blocked by the agent permission classifier** in the build session, so no preview URL exists yet.
Run from a checkout of `claude/redesign` (needs `.vercel/project.json` with project `prj_PqkKF1fI5RU9ZKqSUm2daMWM3wC2`, team `team_ozB0rumoODPirenv75uvypLG`):

    npx vercel@latest deploy --yes          # preview; never --prod

| Build | Branch / commit | URL |
|---|---|---|
| Phase 1 (rules2 + majors merged) | `claude/redesign` @ 8f41b29 (before the redesign) | not deployed |
| Phase 2 (glass redesign) | `claude/redesign` (latest) | not deployed |

Screenshots of the redesign: `docs/design/screenshots/`.
