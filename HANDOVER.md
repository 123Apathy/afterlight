# Everlit landing-page session — HANDOVER

Date: 2026-07-23. All work is **local only, NOT committed or pushed** (standing rule: don't push `netlify-migration`). This doc is the change log so the next session can commit.

## Files changed (uncommitted)
- `public/landing.html` — the marketing landing page. **All the work below is here.**
- `app/app.tsx` + `components/CoachMark.tsx` — earlier-session app fixes (coach-mark round-corner mask, prev/next arrow dark tint). Still uncommitted from before.
- **New asset:** `public/tribute-taster.mp4` — muted ~10s montage used in Card 4 (see below).

## What changed in `public/landing.html`

### Hero
- **Fluid phone (rewrote the responsive system):** phone taken out of the CSS grid, now `position:absolute` sized/placed with `clamp()` (`width: clamp(128px,21vw,292px)`, `right: clamp(14px,3.4vw,58px)`). It now resizes/moves **continuously** — no breakpoint jump/flash. Old grid-flip mobile overrides deleted.
- `.hero-content` → full-bleed single-column (`align-content:center`; mobile `align-content:start; padding-top:80px`). `.hero-right` got `max-width:min(52vw,600px)`. `.hero-title` (wordmark) grid props removed, kept `z-index:4`.
- **Wordmark on top:** `.hero-title { z-index:4 }` (phone is `z-index:2`) — wordmark overlaps phone at all widths (verified 1280/800/390).
- **Mobile phone alignment (final):** in the `@media (max-width:768px)` block, `.phone-mock { top:82px; height:306px; width:auto; transform:none; right:16px }` — top aligns with the heading top, bottom near the CTA. **Tune these two numbers if the CTA position shifts.**
- **Phone sits BEHIND the hero text:** `.hero-right { position:relative; z-index:3 }` (phone is `z-index:2`, wordmark `z-index:4`), so the tagline/description/CTA and the wordmark all render over the phone; the copy has a text-shadow for legibility where it overlaps.
- Nav→content gap halved earlier (mobile `padding-top:80px`).

### Phone mockup UI (now matches the app exactly)
- Header sized to app proportions (cqw = app_px/390): logo 10.5cqw, wordmark 5.4cqw, counter 4.4cqw.
- Grid icon replaced with a true **3×3 of 9 squares** (`.mock-grid-icon`); hamburger = **3 right-aligned lines, short third** (`.mock-burger-icon`).
- Nav arrows: bigger (20.5cqw) + app's **gold inner-ring sheen + dark tint** (`.mock-nav-btn::before`).
- Comment popup = a "Comments" card (gold hairline underline + `♥ 2` reaction), placed above the controls.
- Whole in-phone UI is in `cqw` (container `.phone-mock-screen { container-type:size }`) so it scales at any phone size.

### How-it-works cards (`.features-grid`, 4 cards)
- Titles **centered**; `.card-header { min-height:52px; margin-bottom:18px }` so all bullets align; "Everyone adds<br>their part." wraps.
- Cutoff fixed: `.features-grid height 480→544px`, `.card-media height 56→50%`.
- `.card-media { container-type:size }` — card animations are cqw so they don't overlap.
- **Card 1** create screen sits over the candle (`hero-poster.jpg`).
- **Card 2** WhatsApp beat: elements inset to `left/right:14%` (symmetric), `.invfx-wa-send { right:0; bottom:-12px }` (no longer clipped).
- **Card 3** chat feed (3 msgs: Mom ❤️ / Uncle Ray 😂 / Sarah) inset to `left/right:11cqw`.
- **Card 4** = real video montage (`/tribute-taster.mp4`, `.filmfx-video`) + `.tfx-open` in-memoriam title + `.tfx-song` "An original song · written from your memories" waveform bar. Bullet 2 mentions the custom song.
- Section spacing tightened (`.about`, `.about-card`, `.features` [removed `min-height:100vh`], `.contact-section` paddings).

## Card 4 video — how it was built (to rebuild/retune)
> ⚠️ REMOVED 2026-07-27. This asset was real footage from a real client's tribute
> film, used on the public marketing page without a documented permission record.
> It was deleted from `public/` and from `dist/`. Do not reinstate it, or any
> client footage, without written family permission. Rebuild notes kept only so
> the technique is not lost. Client names and local paths deliberately omitted:
> this repo is public.
- Source render: the client's finished memorial render, in the local
  memorial-video preview folder (path intentionally not recorded here).
- 4 clips extracted with ffmpeg at **t=17.5, 83, 110.5, 148.5** (3s each), `-an` (no audio), cropped bottom 8% to drop the baked-in name caption, scaled to 720w, crossfaded (`xfade fade 0.6s`) → `public/tribute-taster.mp4` (~255KB, 10.2s, 720×376).
- To change clips: re-run the extract+xfade (contact-sheet the render at `fps=1/7` to pick timestamps).

## Not dealt with / watch-outs
- **Scroll-reveal text** (`.about-heading`, `.features-title/subtitle`) is `opacity:0` until an IntersectionObserver adds `.visible`/`.lit`. In headless screenshots it looks blank — it fills on the real site. If you want it robust, make the base state visible.
- **Sample name mismatch:** cards 1–3 use the fictional sample name "Margaret"; Card 4 used real client footage (unnamed on screen). Moot now that Card 4's video is removed, see the warning above.
- Mobile phone `top/height` are hardcoded — re-check if hero copy length changes.
- Dev server on `localhost:8081` may be another session's; the in-app Browser pane can't render this page below the fold (WebGL/backdrop-filter) — used Playwright captures instead (`~/.claude/skills/capture-fullpage-screenshots/shoot.mjs`).

## To commit (next session)
Branch is `netlify-migration` (or the everlit repo's branch). Review `git status`/`git diff`, then commit `public/landing.html`, `public/tribute-taster.mp4`, and the earlier `app/app.tsx` + `components/CoachMark.tsx`. **Do not push unless Deon says so.**
