import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const githubPat = Deno.env.get("GITHUB_PAT");
const githubOwner = Deno.env.get("GITHUB_OWNER");
const githubRepo = Deno.env.get("GITHUB_REPO");

const sb = createClient(supabaseUrl, supabaseKey);

async function tick() {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] Verificando schedules...`);

  try {
    const { data: schedules, error } = await sb
      .from("scan_schedules")
      .select("*")
      .eq("active", true);

    if (error) throw error;
    if (!schedules || schedules.length === 0) return;

    const matched = (schedules as ScanSchedule[]).filter(s => cronMatches(s.cron_expression));
    if (matched.length === 0) return;

    console.log(`  ${matched.length} schedule(s) coincidem.`);

    for (const schedule of matched) {
      if (schedule.source === "supabase" || schedule.source === "both") {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const cronSecret = Deno.env.get("CRON_SECRET");
          if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

          const resp = await fetch(`${supabaseUrl}/functions/v1/scan-emails`, {
            method: "POST",
            headers,
          });
          const data = await resp.json();
          console.log(`  Supabase scan: ${JSON.stringify(data)}`);
        } catch (err: any) {
          console.error(`  Erro Supabase scan: ${err.message}`);
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
          console.log(`  GitHub Actions dispatchado`);
        } catch (err: any) {
          console.error(`  Erro GitHub dispatch: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    console.error(`Erro no tick: ${err.message}`);
  }
}

console.log("🕐 Scheduler Deno iniciado (check a cada 60s)");
await tick();
setInterval(tick, 60_000);