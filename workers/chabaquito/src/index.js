const PROJECT_ID = "cultura-y-cuchara";
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "chabaquito", project: env.FIREBASE_PROJECT_ID || PROJECT_ID });
    }
    return json({ ok: false, error: "Not found" }, 404);
  }
};
