import { corsHeaders } from "../_shared/cors.ts";
import { runSchedulerTick } from "../_shared/scheduler.ts";
import { getEnv } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = getEnv("SUPABASE_URL")!;
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl, supabaseKey);

    const env = {
      supabaseUrl,
      githubPat: getEnv("GITHUB_PAT"),
      githubOwner: getEnv("GITHUB_OWNER"),
      githubRepo: getEnv("GITHUB_REPO"),
      cronSecret: getEnv("CRON_SECRET"),
    };

    const result = await runSchedulerTick(sb, env);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro no scan-scheduler:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
