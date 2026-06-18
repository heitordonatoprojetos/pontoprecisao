// Saves or removes a web-push subscription for the authenticated user.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'subscribe';

    if (action === 'unsubscribe') {
      const endpoint = String(body.endpoint || '');
      if (!endpoint) return json({ error: 'endpoint required' }, 400);
      await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
      return json({ ok: true });
    }

    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return json({ error: 'invalid subscription' }, 400);
    }
    const row = {
      user_id: userId,
      endpoint: sub.endpoint as string,
      p256dh: sub.keys.p256dh as string,
      auth: sub.keys.auth as string,
      user_agent: req.headers.get('user-agent') || null,
      tz: body.tz || 'America/Sao_Paulo',
    };
    const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) {
      console.error('push_subscriptions upsert failed:', error);
      return json({ error: 'Internal server error' }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error('push-subscribe unhandled error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
