// barpi-ai-agents — see wrangler.toml for why. Pass-through for every request except GET from AI user agents.
const AGENT = /Claude-User|Perplexity-User|ChatGPT-User/i;
const HASH = /defaultHash\s*=\s*"([0-9a-f]{32,128})"/;

export default {
  async fetch(request) {
    const ua = request.headers.get("user-agent") || "";
    if (request.method !== "GET" || !AGENT.test(ua)) return fetch(request);
    const first = await fetch(request);
    const type = first.headers.get("content-type") || "";
    if (!type.includes("text/html")) return first;
    const body = await first.text();
    const m = body.length < 2000 ? body.match(HASH) : null;
    if (!m) return new Response(body, first);
    const headers = new Headers(request.headers);
    const cookie = headers.get("cookie");
    headers.set("cookie", (cookie ? cookie + "; " : "") + "challenge_passed=" + m[1]);
    const second = await fetch(new Request(request, { headers }));
    const out = new Response(second.body, second);
    out.headers.set("x-barpi-agent", "challenge-passed");
    return out;
  },
};
