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

function maskToken(token?: string) {
  if (!token) return 'missing';
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
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
    console.log('[PUSH] permission:', perm.receive);
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
      console.log('[PUSH] permission:', perm.receive);
    }
    if (perm.receive !== 'granted') {
      console.warn('[PUSH] permission not granted');
      return;
    }

    PushNotifications.addListener('registration', async (t) => {
      console.log('[PUSH] token:', maskToken(t.value));
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('[PUSH] user:', user ? user.id : 'not authenticated');
      if (userError) {
        console.error('[PUSH] user lookup failed:', userError);
        return;
      }
      if (!user) return;

      const { error } = await supabase
        .from('device_tokens' as any)
        .upsert(
          { user_id: user.id, token: t.value, platform, last_seen: new Date().toISOString() },
          { onConflict: 'user_id,token' } as any
        );

      console.log('[PUSH] token saved:', error ? 'failed' : 'success');
      if (error) {
        console.error('[PUSH] token save error:', error);
        return;
      }
      console.log('[PUSH] token registration result:', { ok: true, userId: user.id, platform, token: maskToken(t.value) });
    });

    PushNotifications.addListener('registrationError', (e) => console.error('[PUSH] registrationError', e));

    // Handle Tap on Notification (Foreground, Background, Cold-Start)
    PushNotifications.addListener('pushNotificationActionPerformed', (evt) => {
      const path = (evt.notification.data as any)?.path || '/grouping/notifications';
      handlePushRoute(path);
    });

    await PushNotifications.register();
  } catch (e) {
    console.error('[push] init failed', e);
  }
}


