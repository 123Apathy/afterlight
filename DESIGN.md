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

- `/favourites` no longer has a flat background (corrected 2026-07-25): it renders `landingSky` under a gradient with `Atmosphere` embers, and its cards use the same `rgba(32,26,24,0.52)` glass as the sheets. Two real breaks remain. It is the only content screen with **no app header** (no wordmark, no menu, no counter), and it is lit by *sky* while every other destination screen is lit by the *candle* (`BackdropVideo`). It also just stops scrolling, while `PhotoGrid`, a lesser screen, closes with a gold streak, the wordmark and a memory count. The payoff screen has the worse ending.
- The floating "Back to the photos" pill on `/favourites` overlaps the card caption behind it at 375px, cutting "Loved by ..." in half.
- Deck letterboxing on desktop: the blurred breathing backdrop is the right answer, but `fillDim` at `rgba(16,14,12,0.55)` flattens it to near-invisible. ~0.40 would let the side bands carry the photo's own colour instead of reading as dead bars.
- Grid view is **not** pure black edge-to-edge tiles (corrected 2026-07-25): it has `paddingTop: 84`, a 2px gap, and a designed footer (streak, wordmark, "Every photo here was chosen with love", memory count).
- Film screen is sparse (fine while it's a placeholder state).
- The tribute closes with "Have a wonderful day." after 25 questions about a person who has died. The one misfire in an otherwise careful copy deck.
- "See What We All Loved" is the only Title Case button in the product; everything else is sentence case.
- The landing hardcodes `--accent: #C49A6C` rather than deriving from `constants/theme.ts`, in a 2756-line single file that inlines its whole design system. Palette drift between the two lanes is a matter of time.
- `app.tsx` duplicates `PhotoGrid`'s `columnsFor` breakpoints so the tour's tile highlight stays correct. Two copies of one truth; they will drift.

## Platform gotcha (learned the hard way, 2026-07-25)

**`hitSlop` does nothing on react-native-web.** RNW 0.21's `Pressable` has no `hitSlop` handling at all (the prop lives only on the legacy `Touchable` mixin, which this codebase never uses), so it is dropped as an invalid DOM prop and every hit area equals its styled box. `PressableScale` now polyfills it with a transparent absolutely-positioned expander child, capped at 44 and measured from `onLayout` so already-large controls do not grow and start stealing presses from their neighbours. **Use `PressableScale`, not a raw `Pressable`, for anything tappable**, or the control silently ships with no hit slop on the platform we actually deploy to.
