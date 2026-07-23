# DESIGN.md — Everlit visual system (as built, 2026-07-24)

## Mood

Candlelit vigil: near-black warm browns, gold accents, photography full-bleed. Quiet, ceremonial, unhurried. The UI recedes; the photos and the flame emblem carry the identity.

## Color (from `constants/theme.ts` — the only source of truth)

- `dark rgb(25,20,19)` page bg · `darkWarm rgb(32,26,24)` · `darkWarmLight rgb(42,35,33)`
- Golds: `gold #D4A976` · `goldWarm #C49A6C` (the workhorse accent) · `goldDeep #A6794A`
- Semantic: `heart #E8536B` (favourite) · `comment #4FCE7E` (green) · `detail #5AA9F0` (blue)
- Text ramp: `white` → `textFaint .77` → `textFainter .60` → `textFaintest .48`
- Glass: `glassLight .08` / `glassMedium .12` / `glassStrong .16` white overlays

## Established surface languages (reuse, don't reinvent)

- **Sheet/menu card**: bg `rgba(32,26,24,0.52)` + 1px border `rgba(255,255,255,0.12)` + radius 24 + `glassBlur` (backdropFilter blur). Used by CommentSheet, DetailsSheet, MenuOverlay, coach-mark bubble.
- **Headings**: Playfair Display 500, gold-underlined section titles in popups (`textDecorationColor: goldWarm`).
- **Body/labels**: Poppins 300/400/500. Overlines: 11px, letterSpacing 3, uppercase, goldWarm.
- **Gold streak divider**: horizontal gradient `rgba(196,154,108,0) → rgba(212,169,118,0.9) → 0`, 170×1.5.
- **Nav arrows**: 80px domed-glass circles (radial sheen + inset rim shadows) with bright gold hand-drawn chevrons + soft drop shadow.
- **Backdrops**: `BackdropVideo` (muted candle loop) + vertical dark gradients on gates/film/tribute/menu/end-slide; `HorizonGlow` radial gold on gates.
- **Brand emblems**: plain flame (`logoGold`), ringed flame (`logoRing`), charcoal ring (`logoRingCharcoal`) — the ring appears at ceremony moments (end slide, loading).

## Motion vocabulary

reanimated `withTiming`, ease in/out cubic/quad, 200–520ms. Signature moves: heart burst + ember drift, comment-nudge green pulse, breathing loading emblem (2600ms), end-slide flame flight + wordmark slide (520ms), staggered opacity handoffs keyed to one progress value. `useReducedMotion` respected everywhere. No bounce/elastic anywhere.

## Known rough edges (candidates for the next UI round)

- `/favourites` is the only content screen with a flat `colors.dark` background — no backdrop, no glow; feels like a different app.
- Deck letterboxing on desktop: photo fills height, bare `colors.dark` side bands.
- Grid view is pure black edge-to-edge tiles (may be intentional Instagram-style).
- Film screen is sparse (fine while it's a placeholder state).
