# Running sponsor slots

Edit `sponsors.json` in this folder and re-upload it. The app picks up changes on next open; no app update needed.

1. Fill in `booking`: your email and/or WhatsApp number, one payment link per placement
   (Razorpay Payment Links or Dodo Payments both work), and an optional `supportLink` for donations.
2. When someone books and pays, put their logo in `logos/` (square PNG or SVG) and add an entry to `sponsors`,
   copying the shape of `_example_sponsor`. `until` is the last day their tile shows (YYYY-MM-DD).
3. Change prices or the number of slots under `placements`.

Links open with `?ref=tend` added so sponsors can see the visits you send them.
The Android app reads the same file once `REMOTE_FEED_URL` in `src/lib/sponsors.js` points at your hosted copy.
