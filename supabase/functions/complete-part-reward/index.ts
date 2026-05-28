import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Random 2-digit number: 0–99 */
function rand2(): number {
  return Math.floor(Math.random() * 100);
}

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
    const courseId = body?.course_id ?? null;

    if (!partId || typeof partId !== 'string') return json({ error: 'part_id required' }, 400);

    // Idempotency: one reward per part completion
    const refId = `complete:${partId}`;
    const { data: existing } = await admin.from('coin_ledger').select('id, xp, coins').eq('user_id', userId).eq('source', 'complete').eq('ref_id', refId).maybeSingle();
    
    if (existing) {
      return json({ awarded: false, reason: 'already', reward_xp: existing.xp, reward_coins: existing.coins });
    }

    // 🎲 Random 2-digit rewards
    const rewardXp = rand2();
    const rewardCoins = rand2();

    // Write to ledger
    const { error: insErr } = await admin.from('coin_ledger').insert({
      user_id: userId, source: 'complete', ref_id: refId, course_id: courseId, xp: rewardXp, coins: rewardCoins,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    // ✅ Atomic profile update (xp + coins + level + streak) via SQL function
    const { data: rewardData, error: rpcErr } = await admin.rpc('add_user_reward', {
      _user_id: userId, _xp: rewardXp, _coins: rewardCoins,
    });

    if (rpcErr) {
      console.error('add_user_reward RPC error:', rpcErr);
      return json({ awarded: true, reward_xp: rewardXp, reward_coins: rewardCoins });
    }

    const result = Array.isArray(rewardData) ? rewardData[0] : rewardData;
    return json({
      awarded: true,
      reward_xp: rewardXp,
      reward_coins: rewardCoins,
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