import { corsHeaders } from "../_shared/cors.ts";

interface ScanSchedule {
  id: string;
  cron_expression: string;
  source: string;
  description: string | null;
  active: boolean;
}

function cronMatches(expression: string): boolean {
  const now = new Date();
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, dom, month, dow] = parts;
  const m = now.getMinutes();
  const h = now.getHours();
  const D = now.getDate();
  const M = now.getMonth() + 1;
  const w = now.getDay();

  const matchField = (pattern: string, value: number): boolean => {
    if (pattern === "*") return true;
    for (const part of pattern.split(",")) {
      if (part.includes("/")) {
        const [base, step] = part.split("/");
        const baseVal = base === "*" ? 0 : parseInt(base, 10);
        if (!isNaN(baseVal) && !isNaN(parseInt(step, 10))) {
          if ((value - baseVal) % parseInt(step, 10) === 0 && value >= baseVal) return true;
        }
      } else if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end) && value >= start && value <= end) return true;
      } else {
        if (parseInt(part, 10) === value) return true;
      }
    }
    return false;
  };

  return matchField(min, m) && matchField(hour, h) && matchField(dom, D) && matchField(month, M) && matchField(dow, w);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const githubPat = Deno.env.get("GITHUB_PAT");
  const githubOwner = Deno.env.get("GITHUB_OWNER");
  const githubRepo = Deno.env.get("GITHUB_REPO");

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: schedules, error } = await sb
      .from("scan_schedules")
      .select("*")
      .eq("active", true);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      console.log("Nenhum schedule activo encontrado.");
      return new Response(JSON.stringify({ matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchedSchedules = (schedules as ScanSchedule[]).filter(s => cronMatches(s.cron_expression));
    console.log(`${matchedSchedules.length} schedule(s) coincidem com o horário actual.`);

    const results: string[] = [];

    for (const schedule of matchedSchedules) {
      if (schedule.source === "supabase" || schedule.source === "both") {
        try {
          const cronSecret = Deno.env.get("CRON_SECRET");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

          const scanUrl = `${supabaseUrl}/functions/v1/scan-emails`;
          const resp = await fetch(scanUrl, { method: "POST", headers });
          const data = await resp.json();
          const msg = `Supabase scan: ${JSON.stringify(data)}`;
          console.log(`  ${msg}`);
          results.push(msg);
        } catch (err: any) {
          const msg = `Erro Supabase scan: ${err.message}`;
          console.error(`  ${msg}`);
          results.push(msg);
        }
      }

      if ((schedule.source === "github" || schedule.source === "both") && githubPat && githubOwner && githubRepo) {
        try {
          const resp = await fetch(
            `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/scan-emails.yml/dispatches`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${githubPat}`,
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ref: "main" }),
            },
          );
          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`GitHub API: ${resp.status} ${errText}`);
          }
          const msg = `GitHub Actions dispatchado com sucesso`;
          console.log(`  ${msg}`);
          results.push(msg);
        } catch (err: any) {
          const msg = `Erro GitHub dispatch: ${err.message}`;
          console.error(`  ${msg}`);
          results.push(msg);
        }
      }
    }

    return new Response(JSON.stringify({ matched: matchedSchedules.length, results }), {
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