export interface ScanSchedule {
  id: string;
  cron_expression: string;
  source: string;
  description: string | null;
  active: boolean;
}

export interface SchedulerEnv {
  supabaseUrl: string;
  githubPat?: string;
  githubOwner?: string;
  githubRepo?: string;
  cronSecret?: string;
}

export interface TickResult {
  matched: number;
  results: string[];
}

export function cronMatches(expression: string): boolean {
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

export async function runSchedulerTick(
  sb: any,
  env: SchedulerEnv,
): Promise<TickResult> {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] Verificando schedules...`);

  const { data: schedules, error } = await sb
    .from("scan_schedules")
    .select("*")
    .eq("active", true);

  if (error) throw error;
  if (!schedules || schedules.length === 0) {
    return { matched: 0, results: [] };
  }

  const matched = (schedules as ScanSchedule[]).filter((s) =>
    cronMatches(s.cron_expression)
  );
  if (matched.length === 0) return { matched: 0, results: [] };

  console.log(`  ${matched.length} schedule(s) coincidem.`);
  const results: string[] = [];

  for (const schedule of matched) {
    if (schedule.source === "supabase" || schedule.source === "both") {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (env.cronSecret) headers["Authorization"] = `Bearer ${env.cronSecret}`;

        const resp = await fetch(
          `${env.supabaseUrl}/functions/v1/scan-emails`,
          { method: "POST", headers },
        );
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

    if (
      (schedule.source === "github" || schedule.source === "both") &&
      env.githubPat && env.githubOwner && env.githubRepo
    ) {
      try {
        const resp = await fetch(
          `https://api.github.com/repos/${env.githubOwner}/${env.githubRepo}/actions/workflows/scan-emails.yml/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.githubPat}`,
              Accept: "application/vnd.github+json",
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

  return { matched: matched.length, results };
}
