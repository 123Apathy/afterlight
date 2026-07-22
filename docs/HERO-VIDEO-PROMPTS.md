# Everlit landing hero — "Gathering of Lights" generation prompts

For Deon to run on Higgsfield. Concept locked 2026-07-22: one continuous
scale-shift shot — a single macro candle flame pulls back and dissolves into a
vast field of distant warm lights (the product's pitch made literal: scattered
lights gathering into one place).

Hard requirements every take must satisfy:
- 16:9, slow motion, warm amber-and-black grade, fine film grain, no people,
  no text/logo baked in
- The ending "field of lights" must stay loose toward the upper-mid frame and
  leave the lower third mostly dark — the hero title (bottom-left) and
  tagline/CTA (bottom-right) overlay there
- 8–10s target length. Looping is handled in post (tail crossfaded back into
  the head), so a "loopable ending" is nice-to-have, not required

## Track A — single continuous shot (try first, 2–3 takes max)

> Extreme macro shot of a single candle flame in near-total darkness, warm
> amber glow, fine embers lifting off the wick. Camera begins an extremely
> slow, continuous pull-back — as it retreats, dozens of additional points of
> warm light gradually resolve out of the darkness in the deep background,
> soft and out of focus at first, gently sharpening. The shot never cuts: it
> ends wide, with the original flame now just one small light among a vast,
> softly glowing field of distant warm lights receding into black, like a
> candlelit vigil seen from a hillside at night. The field of lights sits in
> the upper two thirds of frame; the lower third stays near-black. Continuous
> slow motion throughout, cinematic, 16:9, warm amber-and-black color grade,
> fine film grain, volumetric haze, no people, no text, no logo.

Judge a take by: does the scale shift feel like ONE move (no morphing
weirdness mid-shot), and does the ending leave the lower third dark?

## Track B — two segments blended in post (fallback if A won't cohere)

Segment 1 (macro flame):

> Extreme macro shot of a single candle flame in near-total darkness.
> Near-invisible slow push-in. Fine embers lift off the wick and drift
> upward. Warm amber glow, soft volumetric haze, fine film grain. Cinematic,
> 16:9, no people, no text, no logo, slow motion, seamless loop.

Segment 2 (field of lights):

> Wide shot of a vast, softly glowing field of small warm amber lights
> scattered across near-total darkness, like distant candles or a candlelit
> vigil seen from far away. Extremely slow, almost imperceptible camera
> drift — never static. Lights gently flicker and pulse at different rates.
> Warm amber-and-black color grade, fine film grain, volumetric haze.
> Cinematic, 16:9, no people, no text, no logo, seamless loop, generous
> open dark space in the lower third of frame.

## When footage lands

Drop the file(s) anywhere under `D:\Hermes Work\afterlight\` and say the word.
Remaining steps (agent-side, ~15 min): crossfade the tail into the head so the
loop breathes (ffmpeg), compress for web (~2–4MB target), replace
`public/landing-loop.mp4` in the hero slot, regenerate `hero-poster.jpg` from
a good frame, verify text legibility over the real footage at mobile+desktop.
