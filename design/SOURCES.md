# Sources and licences

Every third-party dependency, font, icon or asset is listed here. No paid services. No AI-generated people, faces or voices.

| Package / asset | Use | Licence |
|---|---|---|
| next, react, react-dom | App framework | MIT |
| json-rules-engine | Rules engine | ISC |
| date-fns | Date maths | MIT |
| zod | Validation | MIT |
| next-intl | i18n (hy/ru/en) | MIT |
| @supabase/supabase-js, @supabase/ssr | Database/auth client | MIT |
| @react-pdf/renderer | PDF orders | MIT |
| @fontsource/noto-sans-armenian, @fontsource/noto-sans | Fonts (UI + PDF) | OFL-1.1 |
| papaparse | CSV import | MIT |
| read-excel-file | Excel import | MIT |
| tailwindcss | Styling | MIT |
| vitest, tsx, eslint, typescript | Dev tooling | MIT / Apache-2.0 |

## Design tokens and assets

| Item | Source | Licence / notes |
|---|---|---|
| Theme tokens (3 themes × light/dark) | `design/tokens.json`, mirrored in `src/app/globals.css` | Own work. Drift is caught by `src/components/theme/tokens.test.ts`. |
| Logo mark, UI icons, mode-toggle icons | Hand-drawn inline SVG (`src/components/landing/icons.tsx`, `src/components/theme/mode-toggle.tsx`) | Own work |
| Open Graph image (`/[locale]/opengraph-image`) | Generated at request time with `next/og` from text + an SVG gauge | Own work; fonts below. No people, no photos. |
| Noto Sans / Noto Sans Armenian `.woff` in `public/fonts/` | @fontsource packages (Google Noto) | OFL-1.1, licence files alongside |
