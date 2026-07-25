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

## RUN 2 -- NEXT (fresh session)
Focus: visual truth. Open the Browser pane (screenshots need it!), walk
EVERY screen at 1280 + 768 + 375, run visual-qa-screenshot-critic and
accessibility-responsive-auditor properly, fix what they surface.
Must-look items: scrubber (unseen), grid view, sheets on mobile width,
tour steps with the new darker scrim, deck arrows on a bright photo.

## RUN 3 -- after run 2
Focus: motion + copy cohesion. motion-microinteraction-designer over
sheets/menu/scrubber; one copy pass (grief-tone consistency, no em
dashes); then re-run the innovation list against what runs 1-2 changed,
prioritize with Deon, and only then implement innovations.

## Session facts a fresh run needs
- Test memorial "Preview Test" (id a65be5f2-d36b-4b82-b926-f6d2c0a1ca6d)
  has 3 seeded photos; localhost:8081 = expo web, :4400 = api server
  (launch.json names: afterlight-web, afterlight-server).
- Impeccable ignores for landing.html live in afterlight/.impeccable/
  config.json (hook resolves config per git repo).
- tsc --noEmit is GREEN and must stay the gate.
