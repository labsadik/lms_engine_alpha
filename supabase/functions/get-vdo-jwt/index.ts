// Structure is nearly identical to get-vdo-otp, but calls the /jwt endpoint for lives
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(supabaseUrl, service);

    const { data: ud } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    const userId = ud?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Invalid user" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const liveId = body?.liveId;
    if (!liveId) return new Response(JSON.stringify({ error: "liveId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: part } = await admin.from('parts').select('id, is_preview, chapters!inner(subjects!inner(course_id))').eq('video_id', liveId).eq('kind', 'live').maybeSingle();
    if (!part) return new Response(JSON.stringify({ error: "Live stream not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const courseId = (part as any).chapters?.subjects?.course_id;
    const isPreview = part.is_preview;

    if (!isPreview) {
      const { data: enr } = await admin.from('enrollments').select('id').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
      const { data: role } = await admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      if (!enr && role?.role !== 'admin') return new Response(JSON.stringify({ error: "Not enrolled" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const VDOCIPHER_API_SECRET = Deno.env.get("VDOCIPHER_API_SECRET");
    if (!VDOCIPHER_API_SECRET) return new Response(JSON.stringify({ error: "Server config error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const vdoRes = await fetch(`https://dev.vdocipher.com/api/live-streams/${liveId}/jwt`, {
      method: "GET",
      headers: { Authorization: `Apisecret ${VDOCIPHER_API_SECRET}`, "Content-Type": "application/json" },
    });

    if (!vdoRes.ok) return new Response(JSON.stringify({ error: "VdoCipher API error" }), { status: vdoRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const vdoData = await vdoRes.json();
    return new Response(JSON.stringify({ jwt: vdoData.jwt }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});