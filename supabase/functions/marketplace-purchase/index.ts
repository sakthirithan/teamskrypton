import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return j({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getUser(token);
    if (claimsErr || !claims?.user) return j({ error: "Unauthorized" }, 401);
    const userId = claims.user.id;

    const body = await req.json();
    const materialId = String(body?.materialId || "");
    const days = Math.floor(Number(body?.days || 0));
    if (!materialId || days < 1 || days > 365) return j({ error: "Invalid input" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: mat, error: matErr } = await admin
      .from("marketplace_materials")
      .select("id, uploader_id, price_per_day, min_days, max_days, status, discount_pct_7d, discount_pct_30d, title")
      .eq("id", materialId)
      .single();
    if (matErr || !mat) return j({ error: "Material not found" }, 404);
    if (mat.status !== "active") return j({ error: "Material not available" }, 400);
    if (mat.uploader_id === userId) return j({ error: "Cannot purchase own material" }, 400);
    if (days < mat.min_days || days > mat.max_days) return j({ error: `Choose ${mat.min_days}-${mat.max_days} days` }, 400);

    let pct = 0;
    if (days >= 30) pct = mat.discount_pct_30d;
    else if (days >= 7) pct = mat.discount_pct_7d;
    const gross = mat.price_per_day * days;
    const total = Math.max(0, Math.round(gross * (100 - pct) / 100));
    const treasuryCut = Math.floor(total * 0.10);
    const uploaderCut = total - treasuryCut;

    // Buyer balance
    const { data: buyerPts } = await admin
      .from("user_points")
      .select("points")
      .eq("user_id", userId)
      .maybeSingle();
    const buyerBefore = buyerPts?.points ?? 0;
    if (buyerBefore < total) return j({ error: "Insufficient Golden Points", needed: total, balance: buyerBefore }, 400);

    // Deduct buyer
    const buyerAfter = buyerBefore - total;
    await admin.from("user_points").upsert({
      user_id: userId,
      points: buyerAfter,
      last_updated_by: userId,
      last_updated_at: new Date().toISOString(),
      notes: `Marketplace purchase: ${mat.title}`,
    }, { onConflict: "user_id" });
    await admin.from("points_history").insert({
      user_id: userId,
      points_change: -total,
      points_before: buyerBefore,
      points_after: buyerAfter,
      operation_type: "subtract",
      reason: `Marketplace: rented "${mat.title}" for ${days}d`,
      performed_by: userId,
    });

    // Credit uploader
    const { data: upPts } = await admin
      .from("user_points")
      .select("points")
      .eq("user_id", mat.uploader_id)
      .maybeSingle();
    const upBefore = upPts?.points ?? 0;
    const upAfter = upBefore + uploaderCut;
    await admin.from("user_points").upsert({
      user_id: mat.uploader_id,
      points: upAfter,
      last_updated_by: userId,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await admin.from("points_history").insert({
      user_id: mat.uploader_id,
      points_change: uploaderCut,
      points_before: upBefore,
      points_after: upAfter,
      operation_type: "add",
      reason: `Marketplace earnings: "${mat.title}" (${days}d rental)`,
      performed_by: userId,
    });

    // Credit treasury
    if (treasuryCut > 0) {
      await admin.rpc("noop").catch(() => {}); // ignored
      const { data: tre } = await admin.from("marketplace_treasury").select("balance, total_collected").eq("id", 1).single();
      await admin.from("marketplace_treasury").update({
        balance: (tre?.balance ?? 0) + treasuryCut,
        total_collected: (tre?.total_collected ?? 0) + treasuryCut,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
    }

    // Purchase: extend if active, else create
    const now = new Date();
    const addMs = days * 24 * 60 * 60 * 1000;
    const { data: existing } = await admin
      .from("marketplace_purchases")
      .select("id, expires_at, days_purchased, gp_paid")
      .eq("material_id", materialId)
      .eq("buyer_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      const cur = new Date(existing.expires_at);
      const base = cur > now ? cur : now;
      const newExpiry = new Date(base.getTime() + addMs);
      await admin.from("marketplace_purchases").update({
        expires_at: newExpiry.toISOString(),
        days_purchased: existing.days_purchased + days,
        gp_paid: existing.gp_paid + total,
      }).eq("id", existing.id);
    } else {
      await admin.from("marketplace_purchases").insert({
        material_id: materialId,
        buyer_id: userId,
        uploader_id: mat.uploader_id,
        days_purchased: days,
        gp_paid: total,
        expires_at: new Date(now.getTime() + addMs).toISOString(),
        status: "active",
      });
    }

    await admin.from("marketplace_materials").update({
      purchase_count: (await admin.from("marketplace_materials").select("purchase_count").eq("id", materialId).single()).data?.purchase_count + 1 || 1,
    }).eq("id", materialId);

    // Notify uploader
    await admin.from("grouping_notifications").insert({
      sender_id: userId,
      recipient_id: mat.uploader_id,
      title: "💰 Marketplace Sale!",
      message: `Your material "${mat.title}" was rented for ${days}d (+${uploaderCut} GP).`,
      type: "marketplace",
    });

    return j({ ok: true, gp_paid: total, uploader_cut: uploaderCut, treasury_cut: treasuryCut, balance: buyerAfter });
  } catch (e) {
    return j({ error: String(e?.message || e) }, 500);
  }
});

function j(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
