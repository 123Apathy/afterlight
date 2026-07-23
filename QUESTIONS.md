# QUESTIONS / logged issues from the 2026-07-24 polish run

All 10 plan steps executed successfully — nothing below blocked the run.

## Pre-existing TypeScript errors (NOT caused by this polish pass, runtime-verified harmless)

`npx tsc --noEmit` reports 5 errors that predate this run. Every affected screen has
been visually verified working in the browser this same day, so these are type-level
only. Logged here per the plan's escalation rule instead of "fixing" them blind:

1. `app/app.tsx(96)` and `app/app.tsx(352)` — TS2345 boolean vs string: the
   `useLocalStorage('everlit.tour.done', false)` hook is typed for strings but is used
   with a boolean. Works at runtime (localStorage coerces); the clean fix is making
   the hook generic, which touches the tour gating logic and deserves its own pass.
2. `app/app.tsx(2323)`, `components/CoachMark.tsx(232)`, `components/PhotoGrid.tsx(283)` —
   TS2551 `StyleSheet.absoluteFillObject does not exist`: the installed React Native
   types disagree with the real API (absoluteFillObject is standard RN and works —
   scrims/overlays using it render correctly). A types-package quirk, not a code bug.
   Do not change these to `absoluteFill` without visual re-verification; spreading
   `absoluteFill` is not guaranteed equivalent.

## Two same-day type errors that WERE fixed during verification (not by the agents)

- `DetailsIcon` was made to require `active` earlier today but the tour's
  `<DetailsIcon />` pulse copies didn't pass it — made the prop optional with
  default `false` (matches the intended white tour appearance).
- An unused `@ts-expect-error` directive in `CoachMark.tsx` (the boxShadow line no
  longer errors under the current types) — directive removed, code unchanged.
