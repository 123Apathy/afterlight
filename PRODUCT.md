# PRODUCT.md — Everlit

register: product

## What this is

Everlit (repo name "afterlight") is a private memorial-photo web app for grieving families, run by Afterlight Memorial Films (Deon, South Africa). A family gathers photos of someone they lost, swipes through them full-bleed, favourites and comments, answers a tribute intake, and later receives a tribute film. Users skew non-technical and elderly; many arrive minutes after a funeral via a WhatsApp invite link. Real client tool in production at everlit.co.za (Netlify), not a demo.

## Register nuance (important)

This is app UI (product register: familiarity, consistency, disappearing into the task) but the task is *grieving together*, so the emotional ceiling is higher than a normal tool: warm, ceremonial, candlelit, unhurried. Delight budget goes to gentle ceremony (heart burst, breathing loading emblem, end-slide flame flight), never to playfulness. No competition/leaderboard framing anywhere (standing copy rule). No em-dashes in any user-facing text (standing owner rule). UK spelling (favourite, honour).

## Surfaces

- `/` marketing landing (`public/landing.html`, static, separate design lane — do not restyle casually; the owner reverted an unrequested landing redesign once already)
- `/app` the swipe deck (the product core) + grid view + gates (Begin / Who's Here / cover photo) + 8-step first-run tour + menu overlay + comment/details sheets + end slide
- `/favourites`, `/film`, `/tribute` secondary screens
- `/terms` static terms page
- Shared `LoadingState` (breathing ringed-flame emblem + comforting phrase carousel)

## Constraints

- React Native / Expo Router rendered via react-native-web; styles are RN StyleSheet objects, NOT css files. Web-only escapes (inline SVG, radial-gradient divs, backdropFilter) exist as established per-file patterns.
- Phone-first; desktop renders the same UI full-width (no separate desktop layouts beyond caps like CONTROLS_BAND_MAX 680 / content maxWidth 640).
- Elderly-accessible: large tap targets, high-contrast text, plain language, one obvious action per screen.
- Tokens live in `constants/theme.ts` (`colors`, fonts Playfair Display + Poppins). Use them; do not invent new hex values without adding a token.
