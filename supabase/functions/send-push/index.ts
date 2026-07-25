// Send FCM push notifications via HTTP v1 API using a service-account JSON.
// Secret required: FCM_SERVICE_ACCOUNT_JSON (full Firebase service account JSON string)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64u = (o: any) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64u(header)}.${b64u(claim)}`;

  const pem = (sa.private_key as string).replace(/\\n/g, '\n');
  const pkcs8 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const jwt = `${unsigned}.${sigB64}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`token: ${JSON.stringify(j)}`);
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const saStr = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    if (!saStr) {
      return new Response(
        JSON.stringify({ error: 'FCM_SERVICE_ACCOUNT_JSON not configured', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const sa = JSON.parse(saStr);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { user_ids, title, body, data }: Body = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('token')
      .in('user_id', user_ids);
    if (error) throw error;
    const list = (tokens || []).map((t: any) => t.token).filter(Boolean);
    if (list.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await getAccessToken(sa);
    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let sent = 0;
    const invalid: string[] = [];
    await Promise.all(
      list.map(async (t) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: t,
              notification: { title, body },
              data: Object.fromEntries(
                Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
              ),
              android: { priority: 'HIGH' },
            },
          }),
        });
        if (res.ok) {
          sent++;
        } else {
          const j = await res.json().catch(() => ({}));
          const code = j?.error?.details?.[0]?.errorCode || j?.error?.status;
          if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') invalid.push(t);
        }
      }),
    );

    if (invalid.length) {
      await supabase.from('device_tokens').delete().in('token', invalid);
    }

    return new Response(JSON.stringify({ sent, invalid: invalid.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('send-push error', e);
    return new Response(JSON.stringify({ error: e.message, sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
