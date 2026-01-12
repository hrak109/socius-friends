# Socius Friends - Setup & Development Guide

Complete guide for setting up OAuth, running tests, and deploying the app on physical Android and iOS devices.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [OAuth Setup](#oauth-setup)
   - [Google Cloud Console Setup](#google-cloud-console-setup)
   - [Android OAuth Configuration](#android-oauth-configuration)
   - [iOS OAuth Configuration](#ios-oauth-configuration)
3. [Running the App Locally](#running-the-app-locally)
4. [Running Tests](#running-tests)
5. [Production Build & Deployment](#production-build--deployment)

---

## Prerequisites

### Required Software
- **Node.js** (v18 or later)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli` (for production builds)
- **Android Studio** (for Android builds, with SDK & emulator)
- **Xcode** (macOS only, for iOS builds)

### Physical Device Requirements
- **Android**: Enable Developer Mode & USB Debugging
- **iOS**: Apple ID (free for development builds, paid for distribution)

---

## OAuth Setup

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sign-In API**:
   - Navigate to **APIs & Services** → **Enable APIs and Services**
   - Search for "Google Identity" and enable it
4. Go to **APIs & Services** → **Credentials**

### Android OAuth Configuration

#### Step 1: Create OAuth Client ID for Android

1. In Google Cloud Console → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **Android** as Application Type
3. Fill in:
   - **Name**: `Socius Friends Android`
   - **Package name**: `com.hai.socius.friends`
   - **SHA-1 certificate fingerprint**: Get this using:
   
   ```bash
   # Debug keystore (for development)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # Release keystore (for production)
   keytool -list -v -keystore /path/to/release-keystore.jks -alias your-key-alias
   ```
4. Create the client

#### Step 2: Create OAuth Web Client ID

1. Create another OAuth client ID → **Web application**
2. Name it `Socius Friends Web Client`
3. Copy the **Client ID** - this is used in your app code

#### Step 3: Download google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or use existing one linked to your Google Cloud project
3. Add an Android app with package name `com.hai.socius.friends`
4. Download `google-services.json`
5. Place it in the project root: `/home/hbb/hai-project/socius-friends/google-services.json`

#### Step 4: Update app.json

Ensure your `app.json` includes the Google Sign-In plugin:

```json
{
    "expo": {
        "android": {
            "package": "com.hai.socius.friends",
            "googleServicesFile": "./google-services.json"
        },
        "plugins": [
            "@react-native-google-signin/google-signin"
        ]
    }
}
```

#### Step 5: Update Web Client ID in Code

In [app/index.tsx](file:///home/hbb/hai-project/socius-friends/app/index.tsx), update the `webClientId`:

```typescript
GoogleSignin.configure({
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
});
```

---

### iOS OAuth Configuration

#### Step 1: Create OAuth Client ID for iOS

1. In Google Cloud Console → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **iOS** as Application Type
3. Fill in:
   - **Name**: `Socius Friends iOS`
   - **Bundle ID**: `com.hai.socius.friends`
4. Create and note the **iOS Client ID**

#### Step 2: Download GoogleService-Info.plist

1. In Firebase Console, add an iOS app with bundle ID `com.hai.socius.friends`
2. Download `GoogleService-Info.plist`
3. Place it in the project root: `/home/hbb/hai-project/socius-friends/GoogleService-Info.plist`

#### Step 3: Update app.json for iOS

```json
{
    "expo": {
        "ios": {
            "bundleIdentifier": "com.hai.socius.friends",
            "googleServicesFile": "./GoogleService-Info.plist"
        },
        "plugins": [
            [
                "@react-native-google-signin/google-signin",
                {
                    "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
                }
            ]
        ]
    }
}
```

> [!IMPORTANT]
> Replace `YOUR_IOS_CLIENT_ID` with the reversed client ID from your iOS OAuth credential.

---

## Running the App Locally

### Install Dependencies

```bash
cd /home/hbb/hai-project/socius-friends
npm install
```

### Environment Configuration

Set the environment in your terminal before running:

```bash
# For development (connects to localhost:8002)
export EXPO_PUBLIC_ENV=development

# For staging
export EXPO_PUBLIC_ENV=staging

# For production (default)
export EXPO_PUBLIC_ENV=production
```

API endpoints are configured in [constants/env.ts](file:///home/hbb/hai-project/socius-friends/constants/env.ts):
- Development: `http://localhost:8002/api/socius`
- Staging: `https://staging-api.oakhillpines.com/api/socius`
- Production: `https://api.oakhillpines.com/api/socius`

### Run on Physical Android Device

1. Connect your Android device via USB (USB Debugging enabled)
2. Verify connection:
   ```bash
   adb devices
   ```
3. Build and run:
   ```bash
   # First time (creates native project)
   npx expo prebuild --platform android
   
   # Run on device
   npx expo run:android --device
   ```

### Run on Physical iOS Device (macOS only)

1. Connect your iPhone via USB
2. Trust the computer on your iPhone
3. Build and run:
   ```bash
   # First time (creates native project)
   npx expo prebuild --platform ios
   
   # Open in Xcode to configure signing
   open ios/SociusFriends.xcworkspace
   
   # Run on device
   npx expo run:ios --device
   ```

> [!NOTE]
> For iOS development, you need to configure signing in Xcode:
> 1. Open the `.xcworkspace` file
> 2. Select the project → Signing & Capabilities
> 3. Select your Team (Apple ID)
> 4. Xcode will manage provisioning profiles automatically

---

## Running Tests

### Unit Tests

```bash
cd /home/hbb/hai-project/socius-friends
npm test
```

> [!WARNING]
> Jest is configured in `package.json` but may need additional setup if not yet configured. If tests fail, install Jest:
> ```bash
> npm install --save-dev jest @types/jest ts-jest
> ```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npx tsc --noEmit
```

---

## Production Build & Deployment

### Using EAS Build (Recommended)

#### Initial Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

This creates `eas.json` with build profiles.

#### Build for Android

```bash
# Development build (APK for testing)
eas build --platform android --profile development

# Production build (AAB for Play Store)
eas build --platform android --profile production
```

#### Build for iOS

```bash
# Development build (installable on registered devices)
eas build --platform ios --profile development

# Production build (IPA for App Store)
eas build --platform ios --profile production
```

> [!CAUTION]
> iOS production builds require a paid Apple Developer account ($99/year).

### Local Production Build (Without EAS)

#### Android APK

```bash
cd /home/hbb/hai-project/socius-friends

# Prebuild native project
npx expo prebuild --platform android

# Build release APK
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

#### iOS IPA (macOS only)

```bash
npx expo prebuild --platform ios

# Open in Xcode
open ios/SociusFriends.xcworkspace

# Archive and export via Xcode:
# Product → Archive → Distribute App
```

---

## Quick Reference Commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Start Metro | `npm start` |
| Run Android | `npm run android` or `npx expo run:android --device` |
| Run iOS | `npm run ios` or `npx expo run:ios --device` |
| Lint | `npm run lint` |
| Test | `npm test` |
| Prebuild Android | `npx expo prebuild --platform android` |
| Prebuild iOS | `npx expo prebuild --platform ios` |
| EAS Build Android | `eas build --platform android` |
| EAS Build iOS | `eas build --platform ios` |

---

## Troubleshooting

### Android: "No connected devices"
```bash
adb kill-server
adb start-server
adb devices
```

### iOS: Provisioning Profile Issues
- Ensure you're signed into Xcode with your Apple ID
- In Xcode: Signing & Capabilities → Check "Automatically manage signing"

### Google Sign-In: Error 10
- Verify SHA-1 fingerprint matches your keystore
- Ensure `google-services.json` is up to date
- Check that `webClientId` matches your Web OAuth client

### Metro Bundler: Port in Use
```bash
# Kill process on port 8081
npx kill-port 8081

# Or start on different port
npx expo start --port 8082
```
