# Motionsite harvest, distilled techniques (2026-07-25)

Source: 7 motionsites.ai reference prompts Deon pulled (Rocket FAQ, Editorial
Collection CTA, FAQ CTA, Kova Testimonial, Arceage Testimonial, Botanical
Shadow About, Lumina footer). Injection-scanned clean. These are the
*techniques* worth keeping, rewritten stack-agnostic; we never copy their
stacks (React/Tailwind/Radix), assets, fonts, or copy. Everlit's landing is
one static HTML file and stays that way.

## Applied to landing.html (2026-07-25)

1. **Blur-up reveal** (Editorial CTA, Kova). Entrance = opacity 0 -> 1,
   translateY 24-40px -> 0, AND blur(8-20px) -> 0, ~0.7-1s ease-out, fired
   once at ~30% visibility. The unblur is what reads as expensive. CSS class
   + IntersectionObserver toggle.
2. **Editorial display type** (Editorial CTA). One huge serif line,
   clamp(60px, 11vw, 160px), line-height ~0.95, with ONE italic word as the
   emotional accent ("Stay *in*"). Ours: "When you're *ready*." in Playfair.
3. **Cursor spotlight ring** (Rocket FAQ). 1px gradient ring that follows the
   cursor: absolutely-inset span, radial-gradient at --spot-x/--spot-y,
   padding 1px, mask-composite exclude so only the ring paints. Global
   mousemove writes the vars per card relative to its rect. Gold, low
   intensity for us. Pointer devices only.
4. **Smooth accordion open/close** (Rocket FAQ). Height animates instead of
   snapping. With native <details> we use the grid-template-rows 0fr -> 1fr
   trick on an inner wrapper (button+div variant), ~0.25s ease.
5. **Staggered row reveal** (Rocket FAQ): each FAQ row delays by ~0.1-0.15s *
   index on first scroll-in.

## Banked for later (not yet built)

- **Quote-first testimonial** (Kova): serif quote at text-2xl, 3fr/2fr grid
  with square looping video right, cross-column stagger (text at 0/.1/.2/.3/.4,
  media at .15). Build ONLY when a real family quote exists.
- **Carousel testimonial** (Arceage): single big right-aligned quote between
  two full-width 1px dividers that reveal via scaleX(0 -> 1) origin-left;
  directional slide (enter from x:+/-100 by direction), spring 300/30;
  typewriter char-stagger (~0.012s/char) on quote. The scaleX divider reveal
  is quiet and very Everlit; usable on any section divider.
- **Static statement section** (Botanical): full-viewport video + single warm
  overlay tint + one centered clamp() serif statement; deliberately NO
  animation. Bottom close = 1px vertical line, icon, small caps subtext.
  Validates Everlit's existing hero/about approach; the vertical-line bottom
  close is a nice quiet section ending.
- **Liquid glass panel** (Lumina): rgba(255,255,255,0.01) bg + blur(4px) +
  inset highlight; ::before gradient ring via same mask-composite trick
  (bright top/bottom edges, transparent middle). Could suit app gate cards or
  a future footer, gold-tinted.
- **@property animated gradient blobs** (FAQ CTA): five radial-gradients whose
  centre/size custom-properties animate via @property interpolation, pure
  CSS. Their palette is wrong for us; recolour to ember golds at low opacity
  if ever used (app loading/gate backdrops).

## Rejected

- Category tabs on a 5-question FAQ (Rocket) - overkill.
- Newsletter forms (Editorial, FAQ CTA) - WhatsApp is our channel.
- Acid gradient palette (FAQ CTA), #000 backgrounds, Inter/Barlow/Cooper
  fonts - off-brand; Everlit stays Playfair + Poppins on warm darks.
