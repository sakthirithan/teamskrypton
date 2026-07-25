import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

export async function initNativePush() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] permission not granted');
      return;
    }

    await PushNotifications.register();

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

    PushNotifications.addListener('pushNotificationActionPerformed', (evt) => {
      const path = (evt.notification.data as any)?.path;
      if (path && typeof path === 'string') window.location.assign(path);
    });
  } catch (e) {
    console.error('[push] init failed', e);
  }
}
