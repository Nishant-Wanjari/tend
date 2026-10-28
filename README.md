# Tend

Reading, money, fitness and habits in one calm tracker.

| Folder | What it is |
|---|---|
| `web/` | The installable web app. Published to GitHub Pages on every change. |
| `android/` | The Android app (the same app in a native shell). Built into an APK on every change. |
| `app-src/` | Source code for the app (React + Tailwind). |

## Get the Android app

Open **Releases → latest → Tend.apk** on your phone, or go straight to
`https://github.com/<your-user>/<this-repo>/releases/latest/download/Tend.apk`.
Open the file and allow installs from your browser if Android asks.
New builds install over the old one and keep your data.

## Web app

After the first publish it lives at `https://<your-user>.github.io/<this-repo>/`.
Turn it on once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Sponsors

Edit `web/sponsors.json` (see `web/SPONSORS.md`). Changes go live on the next publish.

## Signing key

`android/app/tend-release.keystore` signs every APK with the same key so updates keep your data.
Before a Play Store release, create a private key and keep it out of this repository.
