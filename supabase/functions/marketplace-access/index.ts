import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: ce } = await userClient.auth.getUser(token);
    if (ce || !claims?.user) return j({ error: "Unauthorized" }, 401);
    const userId = claims.user.id;

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const materialId = String(body?.materialId || "");
    const action = body?.action === "external_open" ? "external_open" : "view";
    if (!materialId) return j({ error: "materialId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: mat, error: me } = await admin
      .from("marketplace_materials")
      .select("id, uploader_id, source_url, material_type, title, status, view_count")
      .eq("id", materialId)
      .maybeSingle();
    if (me) return j({ error: me.message }, 500);
    if (!mat) return j({ error: "Material not found" }, 404);

    let allowed = mat.uploader_id === userId;
    let expiresAt: string | null = null;

    if (!allowed) {
      const { data: rental } = await admin
        .from("marketplace_purchases")
        .select("expires_at, status")
        .eq("material_id", materialId)
        .eq("buyer_id", userId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rental && new Date(rental.expires_at) > new Date()) {
        allowed = true;
        expiresAt = rental.expires_at;
      }
    }

    if (!allowed) {
      const { data: lead } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (lead && ["team_captain", "vice_captain", "strategist", "team_manager"].includes(lead.role)) {
        allowed = true;
      }
    }

    if (!allowed) return j({ error: "No active rental. Please rent this material to view it." }, 403);

    // Best-effort logging + view bump
    try {
      await admin.from("marketplace_access_log").insert({
        material_id: materialId,
        user_id: userId,
        action: "view",
      });
    } catch (_) {}
    try {
      await admin
        .from("marketplace_materials")
        .update({ view_count: (mat.view_count ?? 0) + 1 })
        .eq("id", materialId);
    } catch (_) {}

    return j({
      ok: true,
      title: mat.title,
      material_type: mat.material_type,
      source_url: mat.source_url,
      expires_at: expiresAt,
    });
  } catch (e: any) {
    console.error("marketplace-access error", e);
    return j({ error: String(e?.message || e) }, 500);
  }
});

function j(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
