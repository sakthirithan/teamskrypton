import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;
let navigationHandler: ((path: string) => void) | null = null;
let pendingPath: string | null = null;

export function setPushNavigationHandler(handler: (path: string) => void) {
  navigationHandler = handler;
  if (pendingPath) {
    handler(pendingPath);
    pendingPath = null;
  }
}

export function handlePushRoute(rawPath?: string) {
  const targetPath = rawPath || '/grouping/notifications';
  if (navigationHandler) {
    navigationHandler(targetPath);
  } else {
    pendingPath = targetPath;
    try {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new Event('popstate'));
    } catch (e) {
      console.warn('[push] fallback nav error:', e);
    }
  }
}

export async function initNativePush() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

    // Create Android High-Priority Notification Channel
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'teams_krypton_default',
        name: 'Teams Krypton Notifications',
        description: 'General team alerts and push notifications',
        importance: 4, // HIGH
        visibility: 1, // PUBLIC
        vibration: true,
        sound: 'default',
      }).catch((e) => console.warn('[push] channel creation error:', e));
    }

    // Check & request runtime notification permissions (POST_NOTIFICATIONS on Android 13+)
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] permission not granted');
      return;
    }

    await PushNotifications.register();

    // Store / Refresh FCM Token
    PushNotifications.addListener('registration', async (t) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('device_tokens' as any)
        .upsert(
          { user_id: user.id, token: t.value, platform, last_seen: new Date().toISOString() },
          { onConflict: 'user_id,token' } as any
        );
    });

    PushNotifications.addListener('registrationError', (e) => console.error('[push] registrationError', e));

    // Handle Tap on Notification (Foreground, Background, Cold-Start)
    PushNotifications.addListener('pushNotificationActionPerformed', (evt) => {
      const path = (evt.notification.data as any)?.path || '/grouping/notifications';
      handlePushRoute(path);
    });
  } catch (e) {
    console.error('[push] init failed', e);
  }
}


