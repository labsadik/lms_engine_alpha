import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(supabaseUrl, service);

    const { data: ud } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    const userId = ud?.user?.id;
    if (!userId) return json({ error: 'Invalid user' }, 401);

    const body = await req.json().catch(() => ({} as any));
    const partId = body?.part_id;
    const minute = Number(body?.minute);
    const courseId = body?.course_id ?? null;

    if (!partId || typeof partId !== 'string') return json({ error: 'part_id required' }, 400);
    if (!Number.isFinite(minute) || minute < 1 || minute > 600) return json({ error: 'invalid minute' }, 400);

    // Validate Enrollment / Admin
    const { data: part } = await admin.from('parts').select('id, is_preview, kind, chapters!inner(subjects!inner(course_id))').eq('id', partId).maybeSingle();
    if (!part) return json({ error: 'Part not found' }, 404);
    if ((part as any).kind === 'live') return json({ error: 'Live parts do not award coins' }, 400);

    const partCourseId = (part as any).chapters?.subjects?.course_id;
    if (!(part as any).is_preview) {
      const { data: enr } = await admin.from('enrollments').select('id').eq('user_id', userId).eq('course_id', partCourseId).maybeSingle();
      const { data: role } = await admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      if (!enr && role?.role !== 'admin') return json({ error: 'Not enrolled' }, 403);
    }

    // Idempotency check
    const refId = `${partId}:m${minute}`;
    const { data: existing } = await admin.from('coin_ledger').select('id').eq('user_id', userId).eq('source', 'video').eq('ref_id', refId).maybeSingle();
    if (existing) return json({ awarded: false, reason: 'already' });

    // Award Coin + XP in ledger
    const { error: insErr } = await admin.from('coin_ledger').insert({
      user_id: userId, source: 'video', ref_id: refId, course_id: courseId || partCourseId || null, xp: 1, coins: 1,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    // ✅ Atomic profile update (xp + coins + level + streak) via SQL function
    const { data: rewardData, error: rpcErr } = await admin.rpc('add_user_reward', {
      _user_id: userId, _xp: 1, _coins: 1,
    });

    if (rpcErr) {
      console.error('add_user_reward RPC error:', rpcErr);
      return json({ awarded: true }); // ledger was written, just profile update failed
    }

    const result = Array.isArray(rewardData) ? rewardData[0] : rewardData;
    return json({
      awarded: true,
      xp: result?.xp,
      coins: result?.coins,
      level: result?.level,
      current_streak: result?.current_streak,
      longest_streak: result?.longest_streak,
    });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});