/**
 * The Hardin Bar — AI cocktail suggestions proxy
 *
 * Forwards cocktail-suggestion requests from index.html to the Anthropic API,
 * keeping the API key server-side (never exposed in the client-side HTML).
 *
 * Deploy:
 *   1. npm install -g wrangler   (if you don't have it already)
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY      ← paste your key when prompted
 *   4. wrangler deploy
 *   5. Copy the deployed *.workers.dev URL into AI_WORKER_URL in index.html
 *
 * Optional: lock ALLOWED_ORIGIN below down to your real domain once it's live,
 * instead of leaving it as "*".
 */

const ALLOWED_ORIGIN = "*"; // e.g. "https://ech-technicalsolutions.com" once deployed

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const { pathname } = new URL(request.url);

    if (pathname !== "/api") {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on the worker" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: body.model || "claude-sonnet-4-6",
          max_tokens: body.max_tokens || 4000,
          messages: body.messages,
        }),
      });

      const data = await anthropicRes.json();

      return new Response(JSON.stringify(data), {
        status: anthropicRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
