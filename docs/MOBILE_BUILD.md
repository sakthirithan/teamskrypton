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
