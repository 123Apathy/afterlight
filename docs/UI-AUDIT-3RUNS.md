# UI audit, 3 runs (Deon-ordered, 2026-07-25)

Protocol: 3 runs of audit/improve/fix/innovate across every screen, expert
lens. Fixes get implemented per run; INNOVATIONS ONLY GET LISTED (Deon:
implement nothing from the innovation list until all 3 runs + all other
fixes are done). Run 1 = screen-by-screen + which of our UI skills applies
where. This file is the cross-session state; continue from "NEXT".

## RUN 1 (2026-07-25, this session) -- screens, skills, fixes

### Screen-by-screen status + applicable skills

| Screen | State after tonight | Skill(s) to run, where |
|---|---|---|
| Landing (public/landing.html) | Strong: spacing pass, FAQ+CTA band+sticky nav, blur-ups, streaks, grain, ember dust, anchored phone | conversion-ui-optimizer (CTA/hierarchy sanity), visual-qa-screenshot-critic (full-page, 3 widths), accessibility-responsive-auditor (gold-on-dark small-text contrast) |
| Create gate (/app) | Good; double-tap guard added | form-ux-specialist (quick pass) |
| Who's here gate | FIXED run 1: silent empty-name Enter now shows hint | -- |
| Join (/join/code) | Dead-end fixed earlier | -- |
| Deck (swipe) | Arrows cleaned, scrubber added, tour dim fixed | motion-microinteraction-designer (heart burst, sheet transitions), emil-design-eng-skill (detail pass) |
| Grid view | Not visually reviewed this session | visual-qa-screenshot-critic + mobile-layout-principles (badge/tap targets at 375px) |
| Favourites | Solid; empty state excellent | mobile-layout-principles (fixed 340px card image height -> aspect-ratio?) |
| Tribute | Draft persistence + hint fixed | form-ux-specialist (25 questions = fatigue; consider progress save/exit affordance messaging) |
| Film | Fine; web-only player ceiling noted | -- |
| Menu overlay | Solid | visual-qa-screenshot-critic |
| Comment/Details sheets | Working | motion-microinteraction-designer (open/close feel) |
| Photo scrubber (new) | Shipped tonight, structurally verified only | visual-qa-screenshot-critic FIRST (nobody has SEEN it), accessibility (keyboard support: arrows/enter?) |

### Run 1 fixes implemented
1. App-wide :focus-visible gold ring injected in _layout.tsx web style
   block (landing had it since tonight; app had ZERO focus styles).
2. "Who's here?" gate: empty-name Enter/tap now shows the same gentle
   gold hint tribute got, instead of doing nothing.

### Run 1 innovation list (DO NOT IMPLEMENT until runs done)
- Film-delivery cinematic reveal (Active Theory lens): opening
  "<name>'s film" as a slow candle-lit curtain/glow rather than a player
  appearing. app/film.tsx.
- Ember-dust drift behind app LoadingState / gates (asset + CSS exist on
  landing already).
- Film grain over the app's gate BackdropVideo (grain.png already in
  public/).
- Scrubber v2: momentum/flick physics + keyboard arrows; possibly reuse
  as the landing phone-mock's animation beat.
- Liquid-glass (gold-tinted) treatment for gate cards / menu cards
  (technique banked in motionsite-techniques.md).

## RUN 2 -- DONE (2026-07-25, same session; pane came back)
Visual truth pass with REAL input on every app surface: deck (new arrows
verified on a photo, prev correctly faded at 01), scrubber (first actual
sighting -- cylinder reads beautifully; drag 01->02 verified; gold rim
tracks), grid view (clean; tile tap jumps deck correctly), menu, comment
sheet. Landing was measured at 3 widths earlier in session.
FOUND + FIXED: scrubber tap-to-pick never worked with real input --
setPointerCapture made the overlay the pointerup target, so picks fell
through to close. Fixed via document.elementFromPoint (95d368f).
Lesson recorded: synthetic-event verification can mask capture-related
bugs; always finish with real clicks.
Noted, not fixed (minor): the counter gives no visual cue it's tappable.

## RUN 3 -- DONE (same session)
Copy: zero em dashes in user-facing strings (toast swap earlier cleared
the last ones); grief-tone consistent.
Motion: one cohesion defect -- the scrubber popped in/out instantly
while everything else breathes. Fixed: 190ms fade in on mount, fade out
through every close path (Esc, backdrop, X, pick). Verified live.
Everything else consistent (PressableScale, damped scrubber, sheets).

## PROTOCOL COMPLETE (all 3 runs).

## IMPECCABLE AUDIT x2 (same session, after the 3 runs)
Run 1: 16/20 Good. Integrity PASS, bundled detector clean. Fixed:
scrubber was pointer-only (arrows/Enter now work), 7 inputs had no
accessibilityLabel, scrubber scale ceiling undocumented.
Run 2: 18/20 Excellent (a11y 3->4, perf 3->4), detector clean again.

## INNOVATION LIST -- ALL IMPLEMENTED (4db7a04), list now closed
1. Film cinematic reveal (curtain + staged title/streak/player) DONE
2. components/Atmosphere.tsx: grain + RISING embers on gates, loading,
   film screen DONE
3. Film grain over app gate backdrop DONE (same component)
4. Scrubber momentum/flick + keyboard arrows DONE
5. Gold-lit edge (goldLitEdge in lib/glass.ts) on menu cards DONE

## WHAT'S ACTUALLY LEFT
Re-verified 2026-07-28 against the code. Three of the four items below had
already been implemented since this list was written; only one is still open.

- **STILL OPEN. Testimonials section on the landing:** BLOCKED on a real family
  quote, never fabricate one. Patterns banked in motionsite-techniques.md.
  This is the only remaining UI item, and it is blocked on Deon, not on work.
- ~~Scrubber: no visual cue the counter is tappable.~~ DONE, `counterPressTappable`
  in app.tsx adds a faint gold underline, web only so native does not advertise
  a dead affordance.
- ~~Tribute: 25 questions is a lot; consider progress/exit messaging.~~ DONE,
  app/tribute.tsx has "N of 25", a progress bar, a Close button, and the note
  "Your answers are kept on this device. You can close and come back."
- ~~Favourites: fixed 340px card image height could become aspect-ratio.~~ DONE,
  favourites.tsx uses `aspectRatio: 1`.

### Fixed 2026-07-28 (not from the audit, found while closing it out)
- **Comment-reaction optimistic-ID race.** `addComment` created a comment with a
  placeholder `optimistic-<photoId>-<ts>` id and never reconciled it with the
  saved row, so reacting to your own just-posted comment POSTed to
  `/api/comments/optimistic-.../reactions`, which cannot resolve. The person got
  "that reaction didn't save" and their heart vanished. `addComment` now swaps in
  the server's row, and `reactToComment` guards the in-flight window with a
  gentle message instead of an error.

- Deploy: everything is committed LOCAL only on netlify-migration, pending the
  next `Deploy Everlit.cmd` run.

## Session facts a fresh run needs
- Test memorial "Preview Test" (id a65be5f2-d36b-4b82-b926-f6d2c0a1ca6d)
  has 3 seeded photos; localhost:8081 = expo web, :4400 = api server
  (launch.json names: afterlight-web, afterlight-server).
- Impeccable ignores for landing.html live in afterlight/.impeccable/
  config.json (hook resolves config per git repo).
- tsc --noEmit is GREEN and must stay the gate.
