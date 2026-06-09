function fetch(req: Request, env: any, ctx: any) {
  console.log(req, env, ctx);
  return new Response("Hello world");
}

export default { fetch }