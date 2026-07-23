# EVERLIT POLISH PLAN — final rounding-off pass (8 fixes + 1 new page)

> **Who executes this:** a low-context, fast agent (Sonnet-fast class). Every fact you need is IN THIS FILE.
> Do not read other docs unless a step says to. Do not improvise. If a step is impossible as
> written (an old_string does not match, a file is missing), STOP that step, append the problem to
> `QUESTIONS.md` in the repo root, and continue with the other steps — they are all independent.
> **Scope:** 10 numbered steps below, then verification, then ONE local git commit. It does NOT
> deploy, push, or touch anything not named in a step.
>
> Repo root for every path in this file: `D:\Hermes Work\afterlight`

## Locked upstream decisions (context — never re-litigate)

- Product name is **Everlit** (repo/tables still say "afterlight" — that is intentional, leave it).
- House copy style: **no em-dashes or en-dashes in any user-facing text**. Replace with comma, colon, or a new sentence. (Standing rule from the owner.)
- **Rank badges on the favourites screen are REMOVED** (owner ratified 2026-07-24: "implement those changes please" in response to the flag that badges contradict the togetherness copy).
- The end slide's broken sentence "remembering their with us" is caused by the CALLER fallback `'their'` (a leftover from the old possessive title "their photos"), not by the component (its own fallback is already `'them'`, verified `app/app.tsx:1622` on 2026-07-24).
- Favourites card images ignore their `aspectRatio: 4/3` style at runtime (measured live 2026-07-24: rendered 638×1067). Fix is a fixed height, which works for both bundled demo images and remote thumbnails.
- `/terms` does not exist anywhere. All three in-app "Terms & Conditions" links open `https://everlit.co.za/terms`, which falls through the SPA catch-all into the app (verified live 2026-07-24). This plan creates a real static terms page.
- Production deploys are PAUSED on Netlify (credits exhausted). **This plan must not deploy or push.** Commit locally only.
- `.env` is gitignored (verified `git check-ignore .env` → ignored, 2026-07-24) but the local deploy script bakes `.env` into the production bundle, so the temporary demo flag MUST be removed (Step 1).

## Locked ID table

| Artifact | Exact name/path |
|---|---|
| New terms page | `public/terms.html` |
| Questions file (only if a step fails) | `QUESTIONS.md` |
| Files edited | `.env`, `app/app.tsx`, `app/favourites.tsx`, `constants/demo.ts`, `app/tribute.tsx`, `public/landing.html`, `netlify.toml` |
| Commit message | exactly the block in Step 10 |

## Steps

### Step 1 — `.env`: remove the temporary demo flag

Open `.env`. Delete these three lines exactly (added 2026-07-24 for local review, must not reach a build):

```
# Temporary for local review tabs — seeds sample photos so grid/end-slide are
# visible without a real backend. Remove before any real deploy prep.
EXPO_PUBLIC_DEMO=1
```

After deletion the file's last line must be `EXPO_PUBLIC_API_BASE=http://localhost:4400`.

### Step 2 — `app/app.tsx`: fix the end-slide fallback grammar

Find this exact line (it is line 697 as of 2026-07-24; match on content, not line number):

```
          projectName={projectDetails?.name || 'their'}
```

Replace with:

```
          projectName={projectDetails?.name || ''}
```

Why (context only, do not act further): the component receiving this prop already falls back to `'them'` for an empty name, producing "remembering them with us." Do NOT touch the other `projectName={projectName}` occurrence in the same file.

### Step 3 — `app/favourites.tsx`: fix card image height + remove rank badges

3a. In the styles, find:

```
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
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
    borderRadius: 16,
  },
```

3b. In the JSX, find:

```
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
```

Delete those 3 lines entirely.

3c. Find:

```
            hearted.map((photo, index) => {
```

Replace with:

```
            hearted.map((photo) => {
```

3d. In the styles, delete BOTH style blocks named `rankBadge` and `rankBadgeText` (each is a full `name: { ... },` block; delete from the name line through its closing `},`).

### Step 4 — `constants/demo.ts`: remove the em-dash from the seed comment

Find:

```
    comments: [{ author: 'Deon', text: 'A favourite moment — summer at the farm.' }] },
```

Replace with:

```
    comments: [{ author: 'Deon', text: 'A favourite moment, summer at the farm.' }] },
```

### Step 5 — `app/tribute.tsx`: fix the unnamed overline ("IN LOVING MEMORY OF THEM")

The exact line below appears TWICE in the file (intro phase and thanks phase). Replace BOTH occurrences (use replace-all):

Find (both):

```
            <Text style={styles.overline}>{fillName(tributeCopy.overline, name).toUpperCase()}</Text>
```

Replace with (both):

```
            <Text style={styles.overline}>{(name?.trim() ? fillName(tributeCopy.overline, name) : 'In loving memory').toUpperCase()}</Text>
```

Result: with a name → "IN LOVING MEMORY OF MARY"; without → "IN LOVING MEMORY". Do not edit `constants/tribute.ts`.

### Step 6 — `public/terms.html`: create the Terms & Conditions page

Create the file with EXACTLY this content (LOCKED — copy verbatim from the first line to END BLOCK; do not rewrite, shorten, or "improve" any sentence):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms &amp; Conditions · Everlit</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Poppins:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: rgb(25, 20, 19);
      color: rgba(255, 255, 255, 0.87);
      font-family: 'Poppins', sans-serif;
      font-weight: 300;
      line-height: 1.75;
      padding: 64px 24px 96px;
    }
    .wrap { max-width: 680px; margin: 0 auto; }
    .overline {
      font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
      color: #C49A6C; text-align: center; margin-bottom: 18px;
    }
    h1 {
      font-family: 'Playfair Display', serif; font-weight: 500;
      font-size: 34px; color: #fff; text-align: center; margin-bottom: 10px;
    }
    .updated {
      text-align: center; font-size: 12.5px; color: rgba(255,255,255,0.45);
      margin-bottom: 48px;
    }
    h2 {
      font-family: 'Playfair Display', serif; font-weight: 500;
      font-size: 21px; color: #fff; margin: 40px 0 12px;
    }
    p { margin-bottom: 14px; font-size: 15px; color: rgba(255,255,255,0.72); }
    a { color: #C49A6C; }
    .back {
      display: block; text-align: center; margin-top: 56px;
      font-size: 14px; color: rgba(255,255,255,0.55);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="overline">Everlit · Memorial Films</p>
    <h1>Terms &amp; Conditions</h1>
    <p class="updated">Last updated: 24 July 2026</p>

    <h2>1. What Everlit is</h2>
    <p>Everlit is a private online space where a family gathers photos and memories of someone they have lost, and where those photos and memories are turned into a tribute film. It is operated from South Africa by Afterlight Memorial Films.</p>

    <h2>2. Your photos and memories stay yours</h2>
    <p>Everything you upload or write in a memorial (photos, comments, favourites, and tribute answers) belongs to you and your family. By adding it, you give us permission to store it, show it to the people who hold the memorial's invite link, and use it to create the tribute film you asked for. We do not sell your content, and we do not use it for advertising or to train artificial intelligence systems.</p>

    <h2>3. Who can see a memorial</h2>
    <p>A memorial is private. It can only be opened by someone who has its invite link. Please share the link thoughtfully, with the family and friends you want involved. Anyone with the link can view photos, add their own, comment, and mark favourites.</p>

    <h2>4. What you agree not to do</h2>
    <p>Please only upload photos you have the right to share, and keep everything you post respectful of the person being remembered and of the other family members taking part. We may remove content or close a memorial that is used to harass, deceive, or harm anyone, or that is unlawful.</p>

    <h2>5. The tribute film</h2>
    <p>Where a tribute film has been arranged, its price, delivery time, and format are agreed with you directly, outside this app. The finished film is yours to keep and share.</p>

    <h2>6. Keeping the service running</h2>
    <p>We work hard to keep memorials available and photos safe, but we cannot promise the service will never be interrupted. Please keep your own copies of irreplaceable photos. To the extent the law allows, our responsibility to you is limited to the amount you actually paid us for the service concerned.</p>

    <h2>7. Removing your content</h2>
    <p>You can ask us at any time to remove a photo, a comment, or an entire memorial, and we will do so within a reasonable time. Message us on WhatsApp at <a href="https://wa.me/27626607269">062 660 7269</a>.</p>

    <h2>8. Changes to these terms</h2>
    <p>If we change these terms in a meaningful way, we will update the date at the top of this page. Continuing to use Everlit after a change means you accept the updated terms.</p>

    <h2>9. Law and contact</h2>
    <p>These terms are governed by the laws of South Africa. For any question about them, message us on WhatsApp at <a href="https://wa.me/27626607269">062 660 7269</a>.</p>

    <a class="back" href="/">Back to Everlit</a>
  </div>
</body>
</html>
```

END BLOCK.

⚠ `PENDING_REVIEW`: this text was written by the planner in plain language and has NOT been reviewed by a lawyer. It is deliberately modest (no fabricated legalese). The owner should read it once before it is considered final. Do not add a visible "draft" banner; the pending-review flag lives in this plan and the commit message only.

### Step 7 — `netlify.toml`: route `/terms` to the new page

Find this exact block (it is the SPA fallback, the LAST redirect in the file):

```
# SPA fallback: anything else that isn't a static asset resolves client-side.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Replace it with (inserting the terms rule ABOVE the fallback):

```
# Extensionless /terms serves the static terms page. Placed before the SPA
# fallback; force not needed because no file exists at the literal path /terms.
[[redirects]]
  from = "/terms"
  to = "/terms.html"
  status = 200

# SPA fallback: anything else that isn't a static asset resolves client-side.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Step 8 — `public/landing.html`: remove the em-dash in card 4

Find (line 2192 as of 2026-07-24):

```
                <p>Yours to keep &mdash; film and gallery, forever</p>
```

Replace with:

```
                <p>Yours to keep, film and gallery, forever</p>
```

### Step 9 — `public/landing.html`: add a small footer

9a. Find this exact line (the closing tag of the contact section; there is exactly one `contact-section` in the file — its section ends immediately before `<script>`; locate the contact section's closing `</section>`; if ambiguous, STOP and log to QUESTIONS.md):

The contact section starts at the line containing `class="contact-section"`. Scroll forward from it to its matching `</section>` (the first `</section>` after the WhatsApp button markup containing `062 660 7269`). Immediately AFTER that `</section>` line, insert this block verbatim (LOCKED):

```html
  <footer class="site-footer">
    <p class="site-footer-brand">Everlit</p>
    <p class="site-footer-line">Made with care in South Africa.</p>
    <p class="site-footer-links">
      <a href="/terms">Terms &amp; Conditions</a>
      <span aria-hidden="true">·</span>
      <a href="https://wa.me/27626607269">WhatsApp us</a>
    </p>
    <p class="site-footer-copy">&copy; 2026 Afterlight Memorial Films</p>
  </footer>
```

9b. In the same file, find the closing `</style>` of the main stylesheet (the FIRST `</style>` in the file). Immediately BEFORE it, insert this CSS verbatim (LOCKED):

```css
    /* Site footer: quiet close to the page, echoes the app's dim gold accents. */
    .site-footer {
      text-align: center;
      padding: 56px 24px 48px;
      background: rgb(18, 14, 12);
    }
    .site-footer-brand {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 19px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 6px;
    }
    .site-footer-line {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.45);
      margin-bottom: 16px;
    }
    .site-footer-links {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.45);
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 14px;
    }
    .site-footer-links a {
      color: #C49A6C;
      text-decoration: none;
    }
    .site-footer-links a:hover { text-decoration: underline; }
    .site-footer-copy {
      font-size: 11.5px;
      letter-spacing: 0.4px;
      color: rgba(255, 255, 255, 0.3);
    }
```

### Step 10 — verify, then commit locally

Run the verification below. If ALL checks pass, run exactly:

```
git add -A
git commit -m "Polish pass: end-slide fallback grammar, favourites image height + rank badges removed, terms page + /terms route + landing footer, dash cleanup, unnamed-overline fix (terms copy PENDING_REVIEW by owner)"
```

**Do NOT `git push`. Do NOT run any deploy script.**

## Verification (run every command from the repo root)

1. Type check (must print nothing and exit 0):
   `npx tsc --noEmit`
   Fallback if tsc errors on PRE-EXISTING issues unrelated to edited files: log the exact errors to QUESTIONS.md and continue only if none of them mention `app.tsx`, `favourites.tsx`, `tribute.tsx`, or `demo.ts`.
2. Demo flag gone (must print nothing):
   `grep -n "EXPO_PUBLIC_DEMO" .env`
3. Fallback fixed (must print exactly one line, containing `|| ''`):
   `grep -n "projectDetails?.name ||" app/app.tsx`
4. Rank badge fully gone (must print nothing):
   `grep -n "rankBadge" app/favourites.tsx`
5. Image height applied (must print one line):
   `grep -n "height: 340" app/favourites.tsx`
6. No em/en dashes in user-facing strings of edited files (must print nothing):
   `grep -n "—" constants/demo.ts | grep -v "//"` and `grep -n "&mdash;\|&ndash;" public/landing.html`
7. Terms page exists and is complete (must print `9`):
   `grep -c "<h2>" public/terms.html`
8. Terms route ordered before the SPA fallback (the `/terms` rule's line number must be SMALLER):
   `grep -n "from = \"/terms\"\|from = \"/\*\"" netlify.toml`
9. Footer present (must print `1`):
   `grep -c "site-footer-copy" public/landing.html`
10. Overline fix applied twice (must print `2`):
    `grep -c "In loving memory').toUpperCase()" app/tribute.tsx`

## DO NOT

- Do NOT `git push`, run `Deploy Everlit.cmd`, `netlify deploy`, or any deploy command (production deploys are paused; deploying is the owner's action).
- Do NOT edit `public/landing-v2.html` (a separate experiment awaiting the owner's verdict).
- Do NOT edit `COPY-CHANGES.md`, `HANDOVER.md`, or anything under `server/` or `netlify/functions/`.
- Do NOT rewrite, shorten, or restyle any LOCKED paste block, including the terms copy — even if a sentence reads oddly to you.
- Do NOT change the favourites heart-count row, "Loved by" line, or comments list — only the two changes in Step 3.
- Do NOT touch the other `projectName={projectName}` occurrence in `app/app.tsx`.
- Do NOT add new dependencies, fonts, or files beyond `public/terms.html` (and `QUESTIONS.md` if needed).
- Do NOT "fix" unrelated lint/type warnings you notice along the way; log them to QUESTIONS.md instead.

## Acceptance checklist

- [ ] `.env` contains no `EXPO_PUBLIC_DEMO` line (verification 2 printed nothing)
- [ ] `app/app.tsx` end-slide caller fallback is `|| ''` and the `projectName={projectName}` line is untouched (verification 3 printed exactly one line)
- [ ] `app/favourites.tsx`: `rankBadge` appears nowhere (verification 4), `height: 340` present (verification 5), map no longer declares `index`
- [ ] `constants/demo.ts` seed comment reads `'A favourite moment, summer at the farm.'` with no em-dash (verification 6 clean)
- [ ] `app/tribute.tsx` has the conditional overline in BOTH phases (verification 10 printed `2`)
- [ ] `public/terms.html` exists with all 9 sections (verification 7 printed `9`) and its text is byte-identical to the LOCKED block (no reworded sentences)
- [ ] `netlify.toml` has the `/terms` redirect ABOVE the `/*` fallback (verification 8 line order)
- [ ] `public/landing.html` has zero `&mdash;`/`&ndash;` (verification 6) and exactly one footer (verification 9 printed `1`)
- [ ] `npx tsc --noEmit` passed, or every reported error was pre-existing and logged to QUESTIONS.md with none touching the edited files
- [ ] Exactly one local commit was made with the exact message from Step 10, and NOTHING was pushed or deployed
- [ ] `QUESTIONS.md` exists ONLY if a step genuinely failed as written, and contains no invented workarounds
