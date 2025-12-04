# Building a standalone Android APK (Windows PowerShell)

This guide shows two recommended ways to produce a standalone APK for the `mobile` app in this repo:

- EAS cloud builds (recommended for Expo managed apps)
- Local Gradle build (if you prefer building locally / have the native project)

Both approaches require an Android signing key (keystore). EAS can manage keys for you, or you can provide one.

---

## Prerequisites (Windows)

- Node.js (v18+ recommended)
- Git
- Android SDK / Android Studio (for local Gradle builds)
- Java JDK (11+), which provides `keytool`
- An Expo account (for EAS)
- Install this project's dependencies in `mobile/`

Open PowerShell in the `mobile` folder and run:

```powershell
cd "c:\Users\aceveronn\Documents\SmartAgro-V-2.0\mobile"
npm install
```

### Install EAS CLI (recommended)

You can install globally or use `npx`/`pnpm`.

```powershell
npm install -g eas-cli
# or
npx eas --version
```

(There is an npm script `npm run eas-install` added for convenience.)

## Option A — Build APK using EAS (cloud)

This is the simplest, most reliable route for Expo-managed apps.

1. Log in to Expo / EAS:

```powershell
eas login
```

2. Initialize EAS for this project (if not already linked):

```powershell
eas project:init
```

3. (Optional) If you want EAS to manage your Android keystore, the EAS build process will prompt you. If you prefer to create a keystore yourself, follow the next section.

4. Build an APK using the included `apk` profile (created in `eas.json`):

```powershell
# in mobile/
npm run build:apk
# or
eas build --platform android --profile apk
```

EAS will run the build in the cloud and print an artifact URL when finished. Download the `.apk` file from that URL.

### If you prefer a development APK (includes dev client behavior)

```powershell
npm run build:apk-dev
# or
eas build --platform android --profile development
```

The `development` profile in `eas.json` is already configured to produce an `apk` (development client). Use it only for internal testing.

## Keystore: generate yourself (optional)

Generate a keystore with `keytool` (from JDK):

```powershell
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Remember the keystore password, alias, and key password. You can then provide this to EAS when prompted or upload via the EAS credentials manager:

```powershell
eas credentials -p android
```

Follow the interactive prompts to upload your keystore and set the release key for the app.

## Option B — Local Gradle build (native build)

Use this if you have a native Android project (or run `expo prebuild` to generate it).

1. Create native project files (if you haven't already). This will generate the `android/` directory:

```powershell
expo prebuild
```

2. Build the release APK locally. In PowerShell on Windows, from the `mobile/android` folder:

```powershell
cd android
gradlew.bat assembleRelease
# or if using the wrapper with ./ (requires WSL or proper env), prefer the .bat on Windows
```

3. The generated release APK will be in:

`android/app/build/outputs/apk/release/app-release.apk`

You must configure signing in `android/app/build.gradle` or in `~/.gradle/gradle.properties` to use your keystore.

## Android SDK / Environment on Windows

Install Android Studio and set environment variables in PowerShell (persist in system settings for convenience):

```powershell
# Example — set for current session only
$env:ANDROID_HOME = 'C:\Users\<your-user>\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-11'
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin"
```

Replace paths with your installed locations.

## Helpful notes and troubleshooting

- The app's `android.package` is configured in `app.config.js` as `com.smartagro.simu`. If you change package name, update EAS project settings and Play Store config accordingly.
- EAS will prompt to manage credentials; choosing automatic management is easiest.
- If builds fail in EAS, copy the full error URL/output and inspect build logs in the EAS web dashboard.
- For large native dependency changes, run `eas build --clear-cache` or run a `prebuild` first.

## Quick checklist (what to run locally)

1. Install deps in `mobile/`:

```powershell
cd mobile
npm install
```

2. Login to EAS and ensure project is linked:

```powershell
eas login
eas project:init
```

3. Build APK (cloud):

```powershell
npm run build:apk
```

4. (Optional) Generate a keystore locally and upload:

```powershell
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
# then
eas credentials -p android
```

5. Download the artifact from the URL printed by EAS when the build finishes.

---

If you want, I can:

- Run a quick validation of `app.config.js` values (package name, versionCode) and bump `versionCode` if you plan to upload to Play Store.
- Add a sample `keystores/` placeholder and `.gitignore` note (not recommended to commit real keystores).
- Walk through generating and uploading a keystore interactively (I'll provide exact commands).

Tell me which next step you want me to take.