import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface EmailPayload {
  recipient_ids: string[];
  title: string;
  message?: string;
  type?: string;
  sender_name?: string;
}

const GATEWAY = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send';

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildHtml(title: string, message: string, type: string, senderName: string) {
  const accent = type === 'alert' ? '#dc2626' : type === 'warning' ? '#d97706' : '#2563eb';
  const safeMsg = (message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#202020;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr><td style="padding:24px 28px 8px 28px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${accent}15;color:${accent};font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;">${type}</div>
      </td></tr>
      <tr><td style="padding:8px 28px 4px 28px;">
        <h1 style="margin:0;font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${safeTitle}</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 20px 28px;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${safeMsg || 'You have a new notification from Teamskrypton.'}</p>
      </td></tr>
      <tr><td style="padding:0 28px 24px 28px;">
        <a href="https://teamskrypton.lovable.app" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;">Open Teamskrypton</a>
      </td></tr>
      <tr><td style="padding:16px 28px 20px 28px;border-top:1px solid #eef0f2;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Sent by ${senderName} via Teamskrypton</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:11px;color:#9ca3af;">You received this because you're a Teamskrypton member.</p>
  </td></tr>
</table></body></html>`;
}

function buildRaw(to: string, subject: string, html: string) {
  const headers = [
    `To: ${to}`,
    `From: Teamskrypton <me>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
  ].join('\r\n');
  return b64url(headers);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: EmailPayload = await req.json();
    if (!payload.recipient_ids?.length || !payload.title) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to read emails from auth.users
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const emails: string[] = [];
    for (const uid of payload.recipient_ids) {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) emails.push(data.user.email);
    }

    if (!emails.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: 'no-emails' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GMAIL_KEY = Deno.env.get('GOOGLE_MAIL_API_KEY');
    if (!LOVABLE_KEY || !GMAIL_KEY) {
      return new Response(JSON.stringify({ error: 'Gmail connector not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml(payload.title, payload.message || '', payload.type || 'info', payload.sender_name || 'Teamskrypton');

    let sent = 0;
    const errors: string[] = [];
    for (const to of emails) {
      const raw = buildRaw(to, payload.title, html);
      const res = await fetch(GATEWAY, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_KEY}`,
          'X-Connection-Api-Key': GMAIL_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });
      if (res.ok) sent++;
      else {
        const t = await res.text();
        errors.push(`${to}: ${res.status} ${t.slice(0, 200)}`);
      }
    }

    return new Response(JSON.stringify({ sent, total: emails.length, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
