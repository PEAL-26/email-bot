import { handleDashboard, handleHealth, handleScan, handleUpdateCron } from "./supabase/functions/_shared/http-handlers.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return handleDashboard();
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return handleHealth();
  }

  if (req.method === "POST" && url.pathname === "/scan") {
    return handleScan(req);
  }

  if (req.method === "POST" && url.pathname === "/update-github-cron") {
    return handleUpdateCron(req);
  }

  return new Response("Not found", { status: 404 });
});
