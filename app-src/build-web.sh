#!/bin/bash
# Packages Tend as a standalone installable web app in dist/web
set -e
cd /home/claude/tracker
rm -rf dist/web && mkdir -p dist/web/icons
python3 - <<'PY'
import json, hashlib
css = open('dist/app.css').read()
js = open('dist/app.js').read().replace('</script', '<\\/script')
ver = hashlib.sha1((css + js).encode()).hexdigest()[:10]
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Tend</title>
<meta name="description" content="Reading, money, fitness and habits in one calm tracker.">
<meta name="theme-color" content="#FAF9F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1311" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tend">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&display=swap">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<style>{css}</style>
</head>
<body>
<div id="root"></div>
<noscript>Tend needs JavaScript turned on.</noscript>
<script>{js}</script>
</body>
</html>
'''
open('dist/web/index.html','w').write(html)
manifest = {
  "name": "Tend", "short_name": "Tend",
  "description": "Reading, money, fitness and habits in one calm tracker.",
  "id": "./", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
  "background_color": "#FAF9F6", "theme_color": "#174D3A", "categories": ["productivity", "lifestyle", "health"],
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
open('dist/web/manifest.webmanifest','w').write(json.dumps(manifest, indent=2))
sw = f'''// Tend service worker: the app shell works offline; fonts and covers are cached as they load.
const VERSION = 'tend-{ver}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'tend-runtime').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the app page: network first so updates arrive, cache when offline
  if (req.mode === 'navigate') {{
    e.respondWith(fetch(req).then((r) => {{ const copy = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return r; }})
      .catch(() => caches.match('./index.html')));
    return;
  }}
  // fonts: cache first
  if (/fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) {{
    e.respondWith(caches.open('tend-runtime').then(async (c) => (await c.match(req)) || fetch(req).then((r) => {{ c.put(req, r.clone()); return r; }})));
    return;
  }}
  // sponsor list and logos: always try the network first so changes show up
  if (url.origin === location.origin && (/sponsors\.json$/.test(url.pathname) || url.pathname.includes('/logos/'))) {{
    e.respondWith(fetch(req).then((r) => {{ const copy = r.clone(); caches.open('tend-runtime').then((c) => c.put(req, copy)); return r; }})
      .catch(() => caches.match(req)));
    return;
  }}
  // own files: cache, then network
  if (url.origin === location.origin) {{
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }}
}});
'''
open('dist/web/sw.js','w').write(sw)
print('web build', ver, round(len(html)/1024), 'KB')
PY
python3 - <<'PY'
from PIL import Image, ImageDraw
S=1024
def sprout(img, cx, cy, s, col):
    d=ImageDraw.Draw(img)
    d.line([(cx, cy+0.30*s),(cx, cy-0.05*s)], fill=col, width=int(0.055*s))
    for side in (-1,1):
        leaf=Image.new('L',(S,S),0); ld=ImageDraw.Draw(leaf)
        w,h=0.30*s,0.15*s
        ld.ellipse((S/2-w/2,S/2-h/2,S/2+w/2,S/2+h/2),fill=255)
        leaf=leaf.rotate(30*side, resample=Image.BICUBIC)
        img.paste(col, (int(cx+side*0.15*s - S/2), int(cy-0.13*s - S/2 + (0.04*s if side==1 else 0))), leaf)
def make(kind):
    img=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(img)
    if kind=='full': d.rectangle((0,0,S,S), fill='#174D3A'); scale=0.72
    else: d.rounded_rectangle((0,0,S-1,S-1), radius=int(S*0.22), fill='#174D3A'); scale=0.95
    sprout(img, S/2, S*0.52, S*scale, '#FAF9F6')
    d.rounded_rectangle((S/2-S*0.17*scale/0.95,S*(0.5+0.30*scale),S/2+S*0.17*scale/0.95,S*(0.535+0.30*scale)), radius=12, fill='#8BAF9A')
    return img
r=make('round'); m=make('full')
r.resize((192,192),Image.LANCZOS).save('dist/web/icons/icon-192.png')
r.resize((512,512),Image.LANCZOS).save('dist/web/icons/icon-512.png')
m.resize((512,512),Image.LANCZOS).save('dist/web/icons/icon-maskable-512.png')
m.convert('RGB').resize((180,180),Image.LANCZOS).save('dist/web/icons/apple-touch-icon.png')
PY
python3 - <<'PY2'
import json, sys
sys.path.insert(0,'.')
feed = {
  "version": 1,
  "currency": "₹",
  "placements": {
    "home":    {"label": "Home screen",   "blurb": "Seen every time someone opens Tend",     "slots": 4, "price": 2999},
    "reading": {"label": "Reading",       "blurb": "Readers tracking books and pages",       "slots": 2, "price": 1499},
    "finance": {"label": "Finance",       "blurb": "People budgeting and saving",            "slots": 2, "price": 1499},
    "gym":     {"label": "Fitness",       "blurb": "People logging workouts",                "slots": 2, "price": 1499},
    "habits":  {"label": "Habits",        "blurb": "People building daily routines",         "slots": 2, "price": 1499},
    "export":  {"label": "After sharing", "blurb": "Shown when someone saves a share card",  "slots": 2, "price": 999}
  },
  "booking": {
    "email": "",
    "whatsapp": "",
    "paymentLinks": {"home": "", "reading": "", "finance": "", "gym": "", "habits": "", "export": ""},
    "supportLink": ""
  },
  "sponsors": [],
  "_example_sponsor": {"placement": "home", "slot": 1, "name": "Acme", "tagline": "Budgeting made simple", "url": "acme.com", "logo": "logos/acme.png", "until": "2026-12-31"}
}
open('dist/web/sponsors.json','w').write(json.dumps(feed, indent=2, ensure_ascii=False))
PY2
mkdir -p dist/web/logos
cat > dist/web/SPONSORS.md <<'MD2'
# Running sponsor slots

Edit `sponsors.json` in this folder and re-upload it. The app picks up changes on next open; no app update needed.

1. Fill in `booking`: your email and/or WhatsApp number, one payment link per placement
   (Razorpay Payment Links or Dodo Payments both work), and an optional `supportLink` for donations.
2. When someone books and pays, put their logo in `logos/` (square PNG or SVG) and add an entry to `sponsors`,
   copying the shape of `_example_sponsor`. `until` is the last day their tile shows (YYYY-MM-DD).
3. Change prices or the number of slots under `placements`.

Links open with `?ref=tend` added so sponsors can see the visits you send them.
The Android app reads the same file once `REMOTE_FEED_URL` in `src/lib/sponsors.js` points at your hosted copy.
MD2
cat > dist/web/README.md <<'MD'
# Tend web app

Everything here is static. Host the folder anywhere that serves HTTPS.

## Free hosting

Netlify (no account setup beyond sign-in): go to app.netlify.com/drop and drag this folder onto the page.
You get a link like https://your-name.netlify.app straight away.

GitHub Pages: put these files in a repo, then Settings → Pages → deploy from the main branch, root folder.

Cloudflare Pages and Vercel work the same way: point them at this folder; there is no build step.

## Install on your phone

Open the link in Chrome on Android, then Profile → Install Tend (or Chrome menu → Add to home screen).
On iPhone: Safari → Share → Add to Home Screen.

## Data

Your entries stay in this browser on this device. Use Profile → Download backup to move them
between the web app, the Android app and the version inside Claude.
MD
ls -la dist/web dist/web/icons
