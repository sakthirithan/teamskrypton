import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send';
const APP_URL = 'https://teamskrypton.lovable.app';

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildHtml(opts: {
  title: string; description: string; options: { id: string; label: string }[];
  token: string; allowMultiple: boolean; deadline: string | null; senderName: string; pollId: string;
}) {
  const { title, description, options, token, allowMultiple, deadline, senderName, pollId } = opts;
  const safeTitle = title.replace(/</g, '&lt;');
  const safeDesc = (description || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const btns = options.map(o => {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/poll-vote?token=${token}&option=${o.id}`;
    const safe = o.label.replace(/</g, '&lt;');
    return `<tr><td style="padding:6px 0;"><a href="${url}" style="display:block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">✓ Vote: ${safe}</a></td></tr>`;
  }).join('');
  const dl = deadline ? `<p style="margin:0 0 8px 0;font-size:12px;color:#dc2626;font-weight:600;">⏰ Voting closes: ${new Date(deadline).toLocaleString()}</p>` : '';
  const multi = allowMultiple ? `<p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;">You may vote for <b>multiple</b> options. Click each choice you support.</p>` : `<p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;">Single choice — clicking again replaces your vote.</p>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#202020;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
  <tr><td style="padding:24px 28px 8px 28px;"><div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#2563eb15;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">📊 Poll</div></td></tr>
  <tr><td style="padding:8px 28px 4px 28px;"><h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:700;color:#111827;">${safeTitle}</h1></td></tr>
  ${safeDesc ? `<tr><td style="padding:12px 28px 4px 28px;"><p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">${safeDesc}</p></td></tr>` : ''}
  <tr><td style="padding:12px 28px 4px 28px;">${dl}${multi}</td></tr>
  <tr><td style="padding:8px 28px 8px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${btns}</table></td></tr>
  <tr><td style="padding:12px 28px 20px 28px;"><a href="${APP_URL}/polls/${pollId}" style="display:inline-block;color:#2563eb;text-decoration:none;padding:8px 0;font-size:13px;font-weight:600;">→ View live results in Teamskrypton</a></td></tr>
  <tr><td style="padding:16px 28px 20px 28px;border-top:1px solid #eef0f2;"><p style="margin:0;font-size:12px;color:#6b7280;">Created by ${senderName} · Your vote is recorded via a secure one-time link.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function buildRaw(to: string, subject: string, html: string) {
  const headers = [
    `To: ${to}`, `From: Teamskrypton <teamskrypton@gmail.com>`, `Reply-To: teamskrypton@gmail.com`,
    `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit', '', html,
  ].join('\r\n');
  return b64url(headers);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const senderId = claims.claims.sub as string;

    const { poll_id, recipient_ids, sender_name } = await req.json();
    if (!poll_id || !recipient_ids?.length) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: poll } = await admin.from('polls').select('*').eq('id', poll_id).maybeSingle();
    if (!poll) return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: options } = await admin.from('poll_options').select('id,label').eq('poll_id', poll_id).order('order_index');
    if (!options?.length) return new Response(JSON.stringify({ error: 'No options' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GMAIL_KEY = Deno.env.get('GOOGLE_MAIL_API_KEY');
    if (!LOVABLE_KEY || !GMAIL_KEY) return new Response(JSON.stringify({ error: 'Gmail connector not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let sent = 0, failed = 0;
    for (const uid of recipient_ids) {
      const { data: userInfo } = await admin.auth.admin.getUserById(uid);
      const email = userInfo?.user?.email;
      if (!email) { failed++; continue; }

      // Get or create per-user token
      let { data: tok } = await admin.from('poll_vote_tokens').select('token').eq('poll_id', poll_id).eq('user_id', uid).maybeSingle();
      if (!tok) {
        const t = randToken();
        const { data: created } = await admin.from('poll_vote_tokens').insert({ poll_id, user_id: uid, token: t }).select('token').single();
        tok = created;
      }
      if (!tok?.token) { failed++; continue; }

      const html = buildHtml({
        title: poll.title, description: poll.description || '', options,
        token: tok.token, allowMultiple: poll.allow_multiple, deadline: poll.deadline,
        senderName: sender_name || 'Teamskrypton', pollId: poll_id,
      });
      const raw = buildRaw(email, `📊 Poll: ${poll.title}`, html);
      const res = await fetch(GATEWAY, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_KEY}`, 'X-Connection-Api-Key': GMAIL_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (res.ok) sent++; else failed++;

      // Log
      await admin.from('email_delivery_log').insert({
        sender_id: senderId, recipient_id: uid, recipient_email: email,
        title: `📊 Poll: ${poll.title}`, message: poll.description || null, type: 'poll',
        status: res.ok ? 'sent' : 'failed', attempts: 1,
      });
    }

    return new Response(JSON.stringify({ sent, failed, total: recipient_ids.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
