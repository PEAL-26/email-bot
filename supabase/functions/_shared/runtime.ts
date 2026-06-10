export function getEnv(name: string): string | undefined {
  if (typeof process !== "undefined") return process.env[name];
  if (typeof (globalThis as any).Deno !== "undefined") return (globalThis as any).Deno.env.get(name);
  return undefined;
}

export async function readTextFile(path: string): Promise<string> {
  if (typeof process !== "undefined") {
    const { readFileSync } = await import("node:fs");
    return readFileSync(path, "utf-8");
  }
  return await (globalThis as any).Deno.readTextFile(path);
}

export interface NodeIncomingMessage {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: string, listener: (...args: any[]) => void): void;
}

export async function incomingToRequest(req: NodeIncomingMessage): Promise<Request> {
  const body = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);
  return new Request(url, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });
}
