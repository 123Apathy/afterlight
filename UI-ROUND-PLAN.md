# UI ROUND PLAN — backgrounds, cards, layout (page by page)

> **Who executes this:** a low-context, fast agent. Every fact is IN THIS FILE. Do not read other
> docs unless a step says to. Do not improvise. If an old_string does not match, SKIP that step and
> report which one failed in your final message — do not guess at a similar-looking spot.
> **Scope:** the exact edits below, then the verification greps. NO git commands, NO deploy.
> Repo root: `D:\Hermes Work\afterlight`

## Locked design decisions (planner-made with the impeccable product register + background art direction — never re-litigate)

- Design system source of truth: `constants/theme.ts` tokens + the surface languages in `DESIGN.md`. No new hex values are introduced anywhere in this plan except as locked literals below.
- **Deck**: the three control labels (Comment / Favourites / Details) sit directly on bright photo pixels (verified against a golden-sky photo: thin white 11px text over near-white sun, fails AA). Fix = the app's own existing bottom-scrim treatment, reused verbatim from EmptyState.
- **Grid**: like/comment badges are 22px tall (below the elderly-friendly tap floor this product commits to). Fix = enlarge to 28px with matching text bump. No layout change.
- **Favourites**: the only content screen with a flat background — gets ONE warm gradient wash at the top (single technique, single hue family, static, pointerEvents none; cards keep their own contrast so legibility is untouched). Also: the card image's own radius 16 inside the radius-24 clipped card leaves dark corner notches — the image drops its radius and lets the card clip it. Empty state gains the ringed flame emblem (ceremony budget, matches loading screen).
- **Tribute**: the question phase stretches full-width on desktop (a 30px question line running 740px+). Fix = same 640 content cap the rest of the app uses.
- **Landing, menu, sheets, gates, film, loading, end slide: NOT in this round.** They were checked and pass, or are owner-protected (landing).

## Page 1 — Deck (`app/app.tsx`)

**1.1** Find (exact, includes the blank line):

```
      </ScrollView>

      {/* Prev/Next: their own row, nudged up above the labelled action
```

Replace with:

```
      </ScrollView>

      {/* Legibility scrim: the control labels sit on raw photo pixels and a
          bright sky washes them out; same treatment EmptyState already uses. */}
      <LinearGradient
        colors={['transparent', 'rgba(16, 14, 12, 0.6)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* Prev/Next: their own row, nudged up above the labelled action
```

(`LinearGradient` is already imported in this file; `styles.bottomScrim` already exists — reuse both, define nothing.)

## Page 2 — Grid (`components/PhotoGrid.tsx`)

**2.1** Find:

```
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 14, 12, 0.6)',
  },
  heart: {
    color: colors.heart ?? '#F26D7D',
    fontSize: 11,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
```

Replace with:

```
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 14, 12, 0.6)',
  },
  heart: {
    color: colors.heart ?? '#F26D7D',
    fontSize: 12.5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12.5,
    fontFamily: 'Poppins_500Medium',
  },
```

**2.2** In the same file there are exactly two `hitSlop={5}` occurrences (the two badge Pressables). Replace BOTH with `hitSlop={8}` (replace-all is safe; verified only those two exist).

## Page 3 — Favourites (`app/favourites.tsx`)

**3.1** Warm top wash. Find:

```
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
```

Replace with:

```
    <View style={styles.page}>
      {/* Warm ambient wash so this screen shares the app's candlelit depth
          instead of a flat page colour; static, one hue, never blocks touches. */}
      <LinearGradient
        colors={['rgba(42, 35, 33, 0.9)', 'rgba(25, 20, 19, 0)']}
        style={styles.topWash}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.scroll}>
```

**3.2** Card image corner fix. Find:

```
  cardImage: {
    width: '100%',
    height: 340,
    backgroundColor: colors.ink,
    borderRadius: 16,
  },
```

Replace with:

```
  cardImage: {
    width: '100%',
    height: 340,
    backgroundColor: colors.ink,
  },
```

**3.3** Empty-state emblem. Find:

```
            <Text style={styles.empty}>
              No favourites yet. Go back and double-tap the photos that matter to you, they&rsquo;ll gather
              here for the whole family to see.
            </Text>
```

Replace with:

```
            <View style={styles.emptyWrap}>
              <Image source={images.logoRing} style={styles.emptyEmblem} resizeMode="contain" />
              <Text style={styles.empty}>
                No favourites yet. Go back and double-tap the photos that matter to you, they&rsquo;ll gather
                here for the whole family to see.
              </Text>
            </View>
```

**3.4** Update the theme import. Find:

```
import { colors } from '../constants/theme';
```

Replace with:

```
import { colors, images } from '../constants/theme';
```

**3.5** Add the three new styles. Find:

```
  empty: {
```

Replace with:

```
  topWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 18,
    paddingVertical: 24,
  },
  emptyEmblem: {
    width: 64,
    height: 64,
    opacity: 0.7,
  },
  empty: {
```

## Page 4 — Tribute (`app/tribute.tsx`)

**4.1** Find:

```
  qPage: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 28,
  },
```

Replace with:

```
  qPage: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 28,
    // Same 640 content cap the rest of the app uses; a 30px question line
    // running the full desktop width read as a wall of serif.
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
```

## Verification (run all; report raw output)

1. `npx tsc --noEmit` — the ONLY acceptable errors are these 5 pre-existing ones (already logged in QUESTIONS.md): app/app.tsx(96) TS2345, app/app.tsx(352) TS2345, app/app.tsx(~2323) TS2551 absoluteFillObject, components/CoachMark.tsx TS2551 absoluteFillObject, components/PhotoGrid.tsx TS2551 absoluteFillObject. Any NEW error = report it and do not proceed to any further step.
2. `grep -c "bottomScrim" app/app.tsx` → must print `3` (style def + EmptyState use + new deck use).
3. `grep -c "height: 28" components/PhotoGrid.tsx` → `1`; `grep -c "hitSlop={8}" components/PhotoGrid.tsx` → `2`; `grep -c "hitSlop={5}" components/PhotoGrid.tsx` → `0`.
4. `grep -c "topWash" app/favourites.tsx` → `2`; `grep -c "emptyEmblem" app/favourites.tsx` → `2`; `grep -n "borderRadius: 16" app/favourites.tsx` → no output.
5. `grep -c "maxWidth: 640" app/tribute.tsx` → `1`.

## DO NOT

- Do NOT touch `public/landing.html`, `public/landing-v2.html`, `components/MenuOverlay.tsx`, `components/CommentSheet.tsx`, `components/DetailsSheet.tsx`, `components/LoadingState.tsx`, or anything under `server/`.
- Do NOT run git, deploy, or edit `.env`.
- Do NOT add new colors, fonts, shadows, borders, or animation beyond the locked blocks.
- Do NOT "align" other styles you notice along the way; report observations instead.

## After execution (planner's own step, not the executor's)

Visual QA in the browser (deck labels over the brightest photo, grid badges, favourites wash + empty state, tribute question width at 800px and 375px), then one local commit:
`UI round: deck label scrim, grid badge tap targets, favourites ambient wash + card corners + empty emblem, tribute desktop width cap`
