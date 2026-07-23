# Copy pass: gentler, warmer, no competition framing

Date: 2026-07-23. Scope: every user-facing string reachable inside the Everlit
app itself (gates, tour, menu, comment/details sheets, tribute, favourites,
end slide) plus the two invite-link surfaces (WhatsApp share message, the
`/join/:code` link-preview meta that mirrors it). The marketing landing page
(`public/landing.html`) was left alone — it's a different audience
(prospective customers, not a grieving family already using the product) and
is being handled separately for layout; say the word if you want a matching
copy pass there too.

## Why these specific changes

Two patterns kept showing up and both work against the "gentle, wholesome,
we-care" feeling you want:

1. **Competition/leaderboard framing.** Several places quietly turned
   favouriting into a popularity contest: "whose moments resonated **most**",
   "**Everybody's** Favourites" (reads as a chart-topper headline), "the
   photos your family loved the **most**", "the moments {name} was loved
   **for**" (ties the person's worth to being loved-by-others, not to being
   remembered). None of this is what anyone intends, but it's the kind of
   thing a grieving reader notices on some level even if they can't name it —
   it turns an act of love into something being measured against others'.
   Fixed by reframing every one of these around **togetherness** ("what you
   all chose to hold onto", "what we all loved") instead of **superiority**
   ("the most").

2. **Efficiency language where warmth belongs.** "Gathers photos... one
   favorite at a time", "going through {name}'s photos", "enriches the
   memorial" — these are all *accurate*, but they're the register of a task
   description, not a companion. Swapped for language that names the actual
   feeling underneath the feature (loneliness is the real fear this product
   answers; "so no one has to grieve alone" says that plainly, once, at the
   very first thing anyone reads).

Two smaller, mechanical fixes folded in along the way since they're exactly
"words a client can see in the app":
- **US/UK spelling drift**: the very first screen said "honor**ed**" and
  "favor**ite**" while literally every other screen in the app says "honour"
  and "favourite". Fixed to match.
- **Em dashes**: your standing house style is no dashes in user-facing copy
  (reads as AI-written). Found and removed two more that had slipped in.

Every rewrite was checked against the existing dash-free, warm, plain-English
voice already established elsewhere in the app (the loading-screen phrases,
the tour text) — nothing here introduces a new voice, it brings a few
straggler screens up to the standard the rest of the app already has.

---

## Begin gate — creating a new memorial (`constants/theme.ts`)

The very first thing anyone sees, before they've done anything at all.

- **Title.** Before: *"We're sorry for your loss."* After: **"Let's help you
  remember them well."** Opening on the word "sorry" is what everyone else
  says; leading with "let's help you" puts you in it with them from the very
  first word, and the condolence still lands two lines later on the Who's
  Here gate (a different, more natural place for it — that's the moment a
  guest actually arrives).
- **Subtitle.** Before: *"Everlit gathers photos from everyone who knew them,
  a digital space where their life can be honored, one favorite at a time.
  Not a eulogy. Just the moments that mattered."* After: **"Everlit brings
  together the photos everyone holds of them into one gentle place, so
  nothing is lost and no one has to grieve alone. Just the moments that
  mattered, gathered with care."** Names the real fear (isolation) and the
  real promise (nothing lost, no one alone) instead of describing the
  feature ("one favorite at a time" is a UI mechanic, not a feeling). Also
  fixes the US spelling (honored/favorite → the UK spelling used everywhere
  else) and drops "Not a eulogy" (a slightly clinical, defensive line that
  doesn't need to be there).

## Who's Here gate — a guest entering their name (`app/app.tsx`)

- **Subtitle.** Before: *"Thank you for being here to help remember them.
  Add your name and it appears with the photos you favourite, so the family
  can see whose moments resonated most."* After: **"Thank you for being here
  to help remember them. Add your name so your favourites carry a little of
  you with them, a quiet way of saying this moment mattered to you too."**
  This was the line you flagged directly — "whose moments resonated most"
  turns every favourite into a data point being compared against everyone
  else's. The new version keeps the exact same mechanic (your name travels
  with what you favourite) but frames it as a private, personal gesture, not
  a public ranking.

## Cover photo gate — choosing the photo people see first (`app/app.tsx`)

- **Subtitle.** Before: *"This is the photo people see first when you share
  the link — often the one displayed at the service, near the casket."*
  After: **"This is the first photo people will see when you share the link
  with your family, so it is worth choosing one that feels like them."**
  "Near the casket" is unnecessarily vivid/clinical for a UI hint, and
  assumes a specific funeral format that not everyone's memorial follows.
  The new line keeps the same practical guidance (choose deliberately) but
  in a gentler, more universal register. Also removes an em dash.

## End slide — after the last photo (`app/app.tsx`)

- **Title.** Before: *"Thank you for going through {name}'s photos."* After:
  **"Thank you for spending this time remembering {name} with us."** "Going
  through photos" is an administrative phrase (like clearing an inbox);
  "spending this time remembering... with us" names what actually just
  happened emotionally, and reads the same whether or not the memorial has a
  name set (no more possessive-apostrophe edge case needed — cleaner code
  too).
- **Subtitle.** Before: *"Now you can see what everyone else loved. Tap
  below to look through the favourites, and the memories, your whole family
  shared."* After: **"Now you can see the moments your whole family chose to
  hold onto. Tap below to see the favourites, and the memories everyone
  shared."** "What everyone else loved" quietly separates "you" from
  "everyone else"; "your whole family chose to hold onto" keeps it as one
  group including the reader.
- **Button.** Before: *"See Everybody's Favourites"* — reads like a
  chart-topper headline. After: **"See What We All Loved."** Same action,
  no leaderboard.

## Favourites screen — the collected favourites (`app/favourites.tsx`)

- **Title.** Before: *"The moments {name} was loved for"* / *"What your
  family loved most"* — both tie the person's worth to being loved-BY-others,
  and "most" is the same comparison pattern again. After: **"What your
  family will always remember about {name}"** / **"What your family will
  always remember."** Reframes the whole screen from "here's the popularity
  results" to "here's a keepsake" — matches the brand's actual promise
  (memories you keep forever), not a scoreboard.
- **Empty state.** Before: *"No favourites yet. Go back and double-tap the
  photos that matter, they'll gather here."* After: **"No favourites yet. Go
  back and double-tap the photos that matter to you, they'll gather here for
  the whole family to see."** Kept the actual instruction ("double-tap")
  intact since people genuinely need to know the gesture — only added the
  warmth around it, didn't sacrifice clarity for poetry.

## Menu — "See your favourites" card (`components/MenuOverlay.tsx`)

- **Subtitle.** Before: *"The photos your family loved the most."* After:
  **"The moments your family chose to hold onto."** Same fix as above,
  applied to the menu entry point for the same screen.

## Invite message — WhatsApp share / copy link (`components/MenuOverlay.tsx`)

Sent as-is when someone taps "Share with family" or "Copy link instead" — the
actual message a guest receives, so this one carries a lot of weight.

- Before: *"We're gathering photos and memories to honour {name}. Add yours
  here: {link}"* After: **"We're gathering everyone's photos and memories of
  {name} in one gentle place. Would you add yours? It means a lot: {link}"**
  "Add yours here" is a flat imperative; "Would you add yours? It means a
  lot" is a real, personal ask — and it's true, which is what makes it work
  as a gentle nudge rather than a marketing line. This is the one place
  where a small, honest reciprocity cue belongs: someone opening this link
  is being asked for something meaningful, and saying so plainly (not
  hiding it behind brisk instructions) is the respectful version of asking.

## Invite link preview — WhatsApp/Facebook link card (`server/app.js`)

The code already has a comment saying this should match the WhatsApp message's
voice exactly, so it's updated to stay in lockstep with the change above.

- **Description** (both the "someone shared this" and generic variants):
  Before: *"...is gathering photos and memories to honour {name}. Add yours
  here, it's a keepsake for the whole family to treasure, no app or account
  needed."* After: **"...is gathering everyone's photos and memories of
  {name} in one gentle place. Add yours here, it's a keepsake the whole
  family will treasure, no app or account needed."**

## Photo details sheet — small polish (`components/DetailsSheet.tsx`)

- **Blurb.** Before: *"Anything you remember helps. It enriches the memorial
  and lets us put the photos in roughly the right order."* After: **"Anything
  you remember helps. It brings the story into focus and helps us place the
  photos in the right order."** "Enriches" is a slightly corporate word;
  "brings the story into focus" is more concrete and human, and still
  explains the actual reason (so the transparency — telling people *why*
  you're asking — stays intact).

## Tribute thank-you — small mechanical fix (`constants/tribute.ts`)

- Removed one remaining em dash in the "thank you" screen's body copy (the
  content itself was already warm and well-written — no wording changed,
  just the dash swapped for a comma to match house style).

---

## What I deliberately left alone

- **The tour/CoachMark text** (all 8 steps), **the loading-screen phrases**,
  **the empty/error states**, and **the comment sheet copy** were all
  already warm, dash-free, and free of comparison framing — I read every one
  of them and made no changes, rather than editing for the sake of it.
- **The "Everyone's favourites" overline** on the favourites screen and the
  **"See your favourites" menu title** were left as-is — they're plain
  section labels ("favourites" as a feature name), not comparison claims.
- **`public/landing.html`** copy (marketing site) — out of scope for this
  pass; flagging in case you want the same treatment there.

## One thing worth your call, not changed here

The favourites screen shows a numbered rank badge on each photo (01, 02, 03…
sorted by heart count) — a visual "top chart" pattern, not wording, so it's
outside what I touched in this pass. It sits a little at odds with the
"togetherness, not competition" fix above even after the wording changes.
Options if you want to revisit it: drop the number entirely (the heart count
is already shown), or reframe it as something like a soft "recently loved"
order instead of an explicit rank. Didn't change it without you weighing in
since it's a UI element, not a string.
