# Everlit — local preview

Hey Keegan — this is a local preview of the Everlit app so you can swipe
through it and get a feel. It runs on your machine with sample photos built
in; you don't need any server, login, or internet database.

## Run it

You need **Node.js** installed (https://nodejs.org — the "LTS" version).

Then, in a terminal, from inside this folder:

```
npm install
npm run web
```

Wait for it to say it's ready, then open the address it prints
(usually **http://localhost:8081**) in your browser. On a phone-sized window
it looks like the real app — narrow the browser or use the device toolbar
(F12 → the phone icon) for the true mobile view.

## What you can do

- **Swipe** left/right through the photos (or use the ‹ › buttons at the bottom).
- **Favourite** a photo — tap the heart, or double-tap the photo (Instagram-style).
- **Comment** — tap "Add a comment" to open the thread and post.
- Enter your name when it asks, so your favourites show as yours.

## What's NOT in this preview

This is offline-only. Uploading your own photos, sharing invite links, and the
printable results report all need the live server, which isn't bundled here.
The menu (top-right) tells you the same thing.

Everything you favourite or comment stays on your device and resets if you
reload — that's expected for a preview.
