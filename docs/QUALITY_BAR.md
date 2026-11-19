# Quality bar (adapted from the WiyMood build guide)

Source: the owner's WiyMood build prompt and resource list (19 Nov 2026). We adopt its working method and its
quality, motion, performance and accessibility rules. We do NOT adopt WiyMood's brand, fonts, art or content:
Tesuch keeps its own "Official" theme and Noto fonts.

## Working method (always)
1. Plan first for anything non-trivial: short options, then a step-by-step plan.
2. Test-driven: write the failing test first (browser test for user flows), watch it fail for the right reason, then build.
3. Bugs: reproduce first, find the root cause by measuring (switch suspects off one at a time), fix only what is broken, keep the code style. Never guess.
4. Check every change in a real browser at 1882×746, 1440×900, 1280×520 and 390×780; click through the flows; zero console errors.
5. Before any deploy: security review of the changes + `pnpm audit --prod`.
6. Deploy to a Vercel preview only; production only when the owner says so.
7. Never report "done" without evidence (tests run, output read, screenshots looked at); say plainly what could not be checked.
8. Name the skills/tools used at the end of a task.

## Content rules (hard)
- Never invent testimonials, client logos, statistics, awards, fine amounts or article numbers. Use visible placeholders and ask.
- Demo data is always labelled as demo/fictional.
- Secrets only in `.env*` / platform settings; never committed or pasted in chat.
- Armenian: natural Eastern Armenian, reformed spelling, ։ ՝ ՞ « », `lang="hy"`.

## Motion and performance
- Tesuch is a daily work tool: motion is minimal and purposeful (feedback, state changes). Landing may use slow, eased motion; no flashing, no neon.
- Animate only `transform` and `opacity`; never `top/left/width/height` per frame.
- Any loop (rAF, canvas, timers for decoration) runs only while on screen (IntersectionObserver) and the tab is visible; cleaned up on unmount.
- No per-frame gradients or full-screen SVG filters.
- No new dependency for a visual flourish unless it clearly pays for itself.
- Budget: on an emulated mid-range phone with CPU throttled 4×, key pages stay interactive (Lighthouse performance ≥ 90 on /hy, /hy/check, /hy/login, /hy/app).

## Accessibility
- `prefers-reduced-motion`: no parallax, drift or intro animation; content shown in place.
- Everything works by keyboard; visible focus; real links with full accessible names; `aria-live` for async results; decorative layers `aria-hidden`.
- Automated checks with axe-core in the browser suite (zero serious/critical violations on every page).
- Text contrast never drops because of a background effect.
- Phones: no horizontal scroll, touch targets ≥ 44px.

## Done means
Unit + DB + full browser suites green; lint and typecheck clean; checked in a real browser at the four sizes above;
no console errors; axe clean; security review done; committed, pushed, Vercel preview link sent.
