import "dotenv/config";
import { createServer } from "http";
import { getEnv, incomingToRequest } from "../../supabase/functions/_shared/runtime.ts";
import {
  handleDashboard,
  handleHealth,
  handleScan,
  handleUpdateCron,
} from "../../supabase/functions/_shared/http-handlers.ts";

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);

  let response: Response;

  if (req.method === "GET" && url.pathname === "/") {
    response = await handleDashboard();
  } else if (req.method === "GET" && url.pathname === "/health") {
    response = await handleHealth();
  } else if (req.method === "POST" && url.pathname === "/scan") {
    const request = await incomingToRequest(req);
    response = await handleScan(request);
  } else if (req.method === "POST" && url.pathname === "/update-github-cron") {
    const request = await incomingToRequest(req);
    response = await handleUpdateCron(request);
  } else {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const text = await response.text();
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(text);
});

const PORT = parseInt(getEnv("PORT") || "3000", 10);
server.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
