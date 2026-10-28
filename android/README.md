# Tend for Android

A native Android wrapper around the Tend tracker. Everything runs offline from the app's own files;
your data stays on the phone.

## Build the APK

    bash ~/Desktop/Tend-Android/build-apk.sh

The first build downloads Gradle and the Android build plugin (a few hundred MB, once), then writes
`Tend.apk` to your Desktop. It uses the SDK at `~/Android/sdk` and Java 17+ (Android Studio's bundled
Java is found automatically).

## Install on your phone

Send `Tend.apk` to the phone (USB, Drive, WhatsApp to yourself), open it and allow
"Install unknown apps" for the app you opened it from. Or with USB debugging on:

    ~/Android/sdk/platform-tools/adb install -r ~/Desktop/Tend.apk

## What the app adds over the web version

- Share cards and backups save to Pictures › Tend and Downloads › Tend.
- Share opens Android's share sheet (Instagram, WhatsApp and so on).
- The phone's back button closes sheets and steps back through screens.
- Status and navigation bars follow the light or dark theme.

## Updating the app

Replace `app/src/main/assets/index.html` with a newer build, bump `versionCode` in
`app/build.gradle`, and run the build script again. Installing over the old app keeps your data.
