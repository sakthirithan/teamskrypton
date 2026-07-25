import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9f6c516d2ea644d189f41b98f40586c1',
  appName: 'teamskrypton',
  webDir: 'dist',
  server: {
    url: 'https://9f6c516d-2ea6-44d1-89f4-1b98f40586c1.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#6366f1'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
