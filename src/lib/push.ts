import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { resolveDeepLink } from '@/lib/deeplink';

let initialized = false;
let navigationHandler: ((path: string) => void) | null = null;
let pendingPath: string | null = null;

export function setPushNavigationHandler(handler: (path: string) => void) {
  navigationHandler = handler;
  if (pendingPath) {
    const safePath = resolveDeepLink(pendingPath);
    pendingPath = null;
    handler(safePath);
  }
}

export function getAndClearPendingPath(): string | null {
  const path = pendingPath;
  pendingPath = null;
  return path;
}

export function handlePushRoute(rawPath?: string) {
  const safePath = resolveDeepLink(rawPath || '/grouping/notifications');
  console.log('[PUSH Route] Dispatched path:', safePath);

  if (navigationHandler) {
    navigationHandler(safePath);
  } else {
    pendingPath = safePath;
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

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[PUSH] permission not granted');
      return;
    }

    PushNotifications.addListener('registration', async (t) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      await supabase
        .from('device_tokens' as any)
        .upsert(
          { user_id: user.id, token: t.value, platform, last_seen: new Date().toISOString() },
          { onConflict: 'user_id,token' } as any
        );
    });

    PushNotifications.addListener('registrationError', (e) => console.error('[PUSH] registrationError', e));

    PushNotifications.addListener('pushNotificationActionPerformed', (evt) => {
      const data = (evt.notification.data as any) || {};
      const rawTargetPath =
        data.path ||
        (data.chat_id
          ? `/grouping/notifications?chat_id=${data.chat_id}`
          : '/grouping/notifications');
      const safePath = resolveDeepLink(rawTargetPath);
      console.log('[PUSH Action Performed] Resolved path:', safePath);
      handlePushRoute(safePath);
    });

    await PushNotifications.register();
  } catch (e) {
    console.error('[push] init failed', e);
  }
}
