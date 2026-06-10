import { createClient } from "@supabase/supabase-js";
import { runSchedulerTick } from "../../supabase/functions/_shared/scheduler.ts";
import { getEnv } from "../../supabase/functions/_shared/runtime.ts";

const supabaseUrl = getEnv("SUPABASE_URL")!;
const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(supabaseUrl, supabaseKey);

const env = {
  supabaseUrl,
  githubPat: getEnv("GITHUB_PAT"),
  githubOwner: getEnv("GITHUB_OWNER"),
  githubRepo: getEnv("GITHUB_REPO"),
  cronSecret: getEnv("CRON_SECRET"),
};

async function tick() {
  try {
    const result = await runSchedulerTick(sb, env);
    if (result.matched > 0) {
      console.log("  Resultados:", result.results);
    }
  } catch (err: any) {
    console.error(`Erro no tick: ${err.message}`);
  }
}

console.log("🕐 Scheduler Deno iniciado (check a cada 60s)");
await tick();
setInterval(tick, 60_000);
