import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_URL = 'https://teamskrypton.lovable.app';

function html(title: string, body: string, color = '#2563eb') {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7f9;color:#111;padding:40px 16px;min-height:100vh;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 4px 24px rgba(0,0,0,0.06);text-align:center;">
<div style="width:56px;height:56px;border-radius:50%;background:${color}18;color:${color};display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;">✓</div>
<h1 style="margin:0 0 12px 0;font-size:22px;">${title}</h1>
<div style="color:#4b5563;font-size:15px;line-height:1.6;">${body}</div>
<a href="${APP_URL}" style="display:inline-block;margin-top:24px;background:${color};color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;">Open Teamskrypton →</a>
</div></body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const optionId = url.searchParams.get('option');
  if (!token || !optionId) {
    return new Response(html('Invalid link', 'This vote link is missing required parameters.', '#dc2626'), { status: 400, headers: { 'Content-Type': 'text/html' } });
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: tok } = await admin.from('poll_vote_tokens').select('poll_id,user_id').eq('token', token).maybeSingle();
  if (!tok) return new Response(html('Invalid or expired', 'This vote link is no longer valid.', '#dc2626'), { status: 404, headers: { 'Content-Type': 'text/html' } });

  const { data: poll } = await admin.from('polls').select('*').eq('id', tok.poll_id).maybeSingle();
  if (!poll) return new Response(html('Poll not found', 'This poll no longer exists.', '#dc2626'), { status: 404, headers: { 'Content-Type': 'text/html' } });
  if (poll.status !== 'open') return new Response(html('Poll closed', 'This poll is no longer accepting votes.', '#d97706'), { status: 403, headers: { 'Content-Type': 'text/html' } });
  if (poll.deadline && new Date(poll.deadline) < new Date()) return new Response(html('Voting closed', 'The deadline for this poll has passed.', '#d97706'), { status: 403, headers: { 'Content-Type': 'text/html' } });

  const { data: opt } = await admin.from('poll_options').select('id,label').eq('id', optionId).eq('poll_id', tok.poll_id).maybeSingle();
  if (!opt) return new Response(html('Invalid option', 'That choice was not found for this poll.', '#dc2626'), { status: 400, headers: { 'Content-Type': 'text/html' } });

  // For single-choice: clear any prior votes by this user on this poll
  if (!poll.allow_multiple) {
    await admin.from('poll_votes').delete().eq('poll_id', tok.poll_id).eq('voter_id', tok.user_id);
  }
  // Insert (idempotent via unique constraint)
  const { error: insErr } = await admin.from('poll_votes').insert({
    poll_id: tok.poll_id, option_id: optionId, voter_id: tok.user_id,
  });
  const already = insErr && String(insErr.message || '').toLowerCase().includes('duplicate');

  const safe = opt.label.replace(/</g, '&lt;');
  const body = already
    ? `You already voted for <b>${safe}</b>.<br><small>Return to the app to change your vote.</small>`
    : `Your vote for <b>${safe}</b> has been recorded.${poll.allow_multiple ? '<br><small>You may click other options in the email to add more votes.</small>' : ''}`;
  return new Response(html('Vote recorded', body), { status: 200, headers: { 'Content-Type': 'text/html' } });
});
