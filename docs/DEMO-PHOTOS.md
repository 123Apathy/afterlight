# Generating the Margaret demo photo set

The sales demo (`/demo`, `constants/demo.ts`) needs eight photos of one
fictional woman, "Margaret". Drop the results into `assets/demo/` as
`01.jpg` to `08.jpg` (gitignored; the app picks them up with no code change),
then re-run the deck screenshot capture so the sales slideshow matches.

## Why generated, and one caution

Generated photos carry no permission risk: Margaret does not exist. The
trade-off is that families buy Everlit on emotional truth, and some
prospects clock AI faces instantly, which can undermine exactly the trust
the demo is meant to build. Generate a set, but judge it harshly: if a
single image looks "AI", replace it. A licensed stock model set is the
fallback if generation does not convince.

## Character sheet (paste into every prompt)

> Margaret, a warm South African woman in her late 70s. Soft silver-grey
> curly hair, kind hazel eyes, gentle deep smile lines, small gold stud
> earrings. Comfortable in soft knitwear in warm neutral tones. Natural
> photography, warm golden light, shallow depth of field, shot on 35mm film,
> gentle grain, no text, no watermark.

Consistency tips: generate photo 1 first, then use your tool's character or
face reference feature (Midjourney `--cref`, Firefly structure/style
reference, ChatGPT "same woman as this image") with photo 1 attached to
every later prompt. Keep the seed fixed where the tool allows it.

## The eight scenes (match constants/demo.ts)

1. **The portrait.** Margaret in profile laughing at golden hour on a farm
   stoep, autumn bokeh behind her. This is the hero and the "most loved"
   photo. Portrait orientation.
2. **Baking with Lily.** Margaret and a granddaughter (8 or 9) baking in a
   sunlit kitchen, flour on both their hands, mid-laugh.
3. **The photo box.** An old tin or wooden box of loose printed photographs
   on a lace tablecloth, her reading glasses beside it. No faces needed.
4. **The farm gate view.** The view she loved: a Karoo or Highveld sunset
   over a fence line, no people.
5. **The quiet one.** A lit candle beside her armchair, her knitting or a
   teacup nearby. Still life, no faces.
6. **With Thandi.** Margaret and her neighbour (a woman in her 60s) sharing
   tea and laughing at a kitchen table, winter light.
7. **The garden.** Margaret watering or picking flowers in her garden,
   morning light, seen from a respectful distance.
8. **The family table.** A long table after Sunday lunch, chairs pushed
   back, warm evening light. She is present by implication, not in frame.

Scenes 3, 4, 5 and 8 are deliberately faceless: they break up the AI-face
risk, they read as "real family archive", and they give the deck variety.

## Technical

- Portrait orientation, at least 1200 px on the long edge, JPG.
- Warm grade throughout (the app's candlelit UI sits on top of them).
- Aim all faces slightly off-camera; direct eye contact is where AI shows.

## After dropping the files in

```
node scripts/prepare-demo-photos.mjs   # no-op if all 8 slots are filled
npx expo start --web                    # check /demo end to end
node scripts/seed-demo-project.mjs      # reseed the real demo memorial
```
