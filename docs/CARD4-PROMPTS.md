# Landing card 4 — "Receive the film" still-image prompts

Six generation prompts for Deon to run on Higgsfield. Written 2026-07-25 to
**replace `public/tribute-taster.mp4`**, which is real footage from Brenda's
finished tribute film currently playing as the background of card 4 on the
landing page. A real client's memorial film should not be a marketing asset.

## The decision behind these prompts

**No people with visible faces.** The obvious brief would be "generate a warm
family montage", but a synthetic family grieving a synthetic person, sold to
real grieving families, is the wrong trade for this brand. If a visitor ever
clocks it as AI-generated people, the damage lands exactly where trust matters
most. These six are object-and-atmosphere led instead: hands, prints, candles,
projected light, an empty room after a service. They depict **the ritual**,
not a fake client. Where a person appears they are turned away, cropped, or
so far out of focus they read as "someone's family" rather than any specific
person. This also matches the product's own design language, where the
interface recedes and atmosphere carries the feeling.

**No "come alive" versions of these.** The micro-motion treatment is only ever
applied to a real family's own photographs, after they have submitted them,
for use inside their own video. It is client work, not marketing. Card 4 takes
stills only. (See `HQ Vault/projects/memorial-video/higgsfield-batch/PROMPTS.md`
for the come-alive house style; do not apply it here.)

## Hard requirements for every image

- **16:9**, generated large. The slot is `object-fit: cover` and its aspect
  changes between the mobile 1-column card (~1.59:1) and the desktop 4-up grid,
  so the frame must survive a centre crop in both directions.
- **Warm amber and near-black grade.** Match the site: background `rgb(25,20,19)`,
  accents `#C49A6C` and `#D4A976`. Candlelight, lamplight, or low window light.
  No cool blues, no daylight white balance, no bright whites.
- **Fine film grain, soft vignette, gentle haze.** These sit under an existing
  vignette and scrim, so a frame that already has depth in the corners will not
  fight them.
- **Composition:** keep the **bottom third clear of important detail**, the
  "An original song / written from your memories" caption sits there. Keep the
  **top-left quiet**, "In loving memory" sits there. Put the subject in the
  middle band, slightly right of centre.
- **No text, no logos, no watermarks, no UI.**
- **No identifiable faces**, and nothing that reads as a specific real person.

**Shared suffix, paste onto every prompt:**

> Cinematic still, 16:9, warm amber and near-black colour grade, candlelit,
> fine film grain, soft vignette, shallow depth of field, no text, no logo,
> no watermark, no identifiable faces.

---

## 1. Hands holding a printed photograph

> Close crop on a pair of older hands holding a single printed photograph at a
> table in a dim room, warm lamplight from the left. The photograph's own image
> is soft and indistinct, out of focus, only its white border and the grain of
> the paper are sharp. Dust drifts in the light. Deep shadow fills the lower
> part of the frame.

*Why: the exact gesture the product is about, with zero claim about whose photo
it is.*

## 2. Framed photograph beside a candle

> A simple framed photograph standing on a dark wooden mantel beside a single
> lit candle, warm flame glow falling across the frame's glass. The image inside
> the frame is deliberately out of focus and unreadable, reflecting a little of
> the candlelight. Deep near-black background behind. Quiet, still, reverent.

*Why: the memorial object itself, and the flame ties it to the brand mark.*

## 3. Scattered prints on a table

> Overhead view of a small pile of old printed photographs spread loosely across
> a dark wooden table under a warm pool of lamplight, edges curling, some
> overlapping. The printed images are soft and low-contrast, none legible.
> Shadow falls away to near-black at the edges of the frame.

*Why: "the best photos are never in one place", made literal, and it is the one
frame in the set that shows plurality.*

## 4. Projected light in a dark room

> A dark room with a beam of warm projector light cutting through the air toward
> a blank wall, thick with drifting dust motes. The projected rectangle on the
> wall is soft, warm and empty, no discernible image. Rows of empty chair backs
> silhouetted in the near-dark foreground. Cinematic, still, hushed.

*Why: this is the card about receiving a film, and it is the only frame that
says "screening" without showing a screen full of strangers.*

## 5. The room after the service

> A quiet room after a gathering has ended: empty wooden chairs turned at
> angles, a few white flowers on a side table, warm late-afternoon light coming
> through a window at the right and falling in a long soft band across the
> floor. No people. Dust in the light. Warm, still, gently melancholy.

*Why: carries the emotional register with no person in frame at all.*

## 6. A family, far out of focus

> Warm interior at dusk, a single lit candle sharp in the near foreground at the
> right of frame. Far behind it and heavily out of focus, the soft shapes of
> three or four people gathered close together, unrecognisable, rendered as warm
> blurred forms and bokeh highlights. Deep shadow across the lower third.

*Why: the one frame with people in it, kept unrecognisable on purpose so it
reads as human warmth rather than as a specific family.*

---

## When the images land

Drop them anywhere under `D:\Hermes Work\afterlight\` and say the word.
Remaining steps, agent side:

1. Pick the strongest 3 to 5, judged on whether they survive the centre crop at
   both card aspects and whether the bottom third stays quiet.
2. Compress for web and place in `public/`.
3. Replace the `<video class="filmfx-video" src="/tribute-taster.mp4">` in card 4
   of `public/landing.html` with a slow cross-dissolving still montage, matching
   the pacing of the existing card backgrounds.
4. Verify at 375px and desktop that the "In loving memory" and "An original song"
   overlays stay legible over every frame in the rotation, measuring contrast
   rather than eyeballing it.
5. Delete `public/tribute-taster.mp4` once nothing references it, so Brenda's
   footage stops shipping in the bundle.
