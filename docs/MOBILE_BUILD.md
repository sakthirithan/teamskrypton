# Krypton Space - PWA & Mobile App

## Progressive Web App (PWA)

Krypton Space is now a Progressive Web App! Users can:

1. **Install on Mobile**: Visit the app in a browser and tap "Add to Home Screen"
2. **Install on Desktop**: Click the install icon in the browser address bar
3. **Offline Support**: Basic UI caching for faster loads

## Android APK (Capacitor)

To build an Android APK:

### Prerequisites
- Node.js installed
- Android Studio installed
- Android SDK configured

### Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd <project-folder>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add Android platform**
   ```bash
   npx cap add android
   ```

4. **Build the web app**
   ```bash
   npm run build
   ```

5. **Sync with Capacitor**
   ```bash
   npx cap sync android
   ```

6. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

7. **Build APK**
   - In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)

### Hot Reload Development

The Capacitor config is set up for hot reload during development:
- The app will connect to the Lovable preview URL
- Changes in Lovable will be reflected instantly on your device

### Production Build

For production, update `capacitor.config.ts`:
```typescript
server: {
  // Comment out or remove the url for production builds
  // url: 'https://...',
}
```

## iOS Build

Similar to Android, but requires:
- macOS with Xcode installed
- Apple Developer account for distribution

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Test Session (Sandbox Mode)

Team Captain and Vice Captain can access Test Session mode:
- Creates isolated test data
- Won't affect production data
- Automatically cleaned up when session ends

## Push Notifications (Android, FCM)

The app registers native FCM tokens and stores them in the `device_tokens` table. The `send-push` edge function reads tokens by user id and delivers via Firebase HTTP v1 in the background.

### One-time Firebase setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Add an Android app with the applicationId `app.lovable.9f6c516d2ea644d189f41b98f40586c1`.
3. Download `google-services.json` and place it at `android/app/google-services.json`.
4. In the Firebase console, Project Settings → Service accounts → Generate new private key → download the JSON. Paste the full JSON string into the project secret `FCM_SERVICE_ACCOUNT_JSON` (already requested by Lovable).

### Build & run

```bash
git pull
npm install
npx cap add android            # first time only
npm run build
npx cap sync android
npx cap open android
```

In Android Studio: Build → Build Bundle(s)/APK(s) → Build APK(s).

### How it works

- On first native launch (after login), the app asks for notification permission, receives an FCM token, and upserts it to `device_tokens` (unique per `user_id + token`).
- Any notification that flows through `send-notification-email` (bell notifications, polls, project lead assignment, alerts) also fan-outs to `send-push`, which sends a native push in parallel to email.
- Background delivery is handled by the FCM Android messaging service registered by `@capacitor/push-notifications`. No extra native Java is required.
- Tapping a push with a `data.path` field navigates the app to that route.

### Production toggle

For a store build, remove the `server.url` block in `capacitor.config.ts` so the APK bundles the built web assets instead of loading the Lovable preview.
