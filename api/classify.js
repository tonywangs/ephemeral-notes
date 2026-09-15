// api/classify.js — Vercel serverless function.
// Reads ANTHROPIC_API_KEY from the environment and classifies journal clauses
// into moods, so the key never touches the browser. The client (mood.js) calls
// this at POST /api/classify when the built-in window.claude isn't available.
//
// Deploy: set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL) in your Vercel
// project's Environment Variables. Run locally with `vercel dev`.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    return;
  }

  // Body may arrive parsed (Vercel) or as a string (some runtimes).
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const clauses = Array.isArray(body && body.clauses) ? body.clauses : [];
  const moods =
    Array.isArray(body && body.moods) && body.moods.length
      ? body.moods
      : ["anger", "gratitude", "joy", "hope", "calm", "sadness", "fear", "anxiety", "tenderness", "reflective"];

  if (!clauses.length) {
    res.status(200).json({ moods: [] });
    return;
  }

  const numbered = clauses.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const prompt =
    `You are an emotion classifier for a journaling app. For each numbered fragment ` +
    `of someone's private writing, choose the single mood that best matches its emotional tone.\n\n` +
    `Allowed moods (use these exact ids): ${moods.join(", ")}.\n` +
    `Use "reflective" for neutral, contemplative, or factual fragments.\n\n` +
    `Fragments:\n${numbered}\n\n` +
    `Respond with ONLY a JSON array of ${clauses.length} lowercase mood ids, in order. ` +
    `Example: ["joy","sadness","reflective"]. No prose.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      res.status(502).json({ error: "anthropic " + r.status, detail: detail.slice(0, 500) });
      return;
    }

    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "";
    const match = text.match(/\[[\s\S]*\]/);
    let parsed = null;
    try { parsed = JSON.parse(match ? match[0] : text); } catch (e) {}

    if (Array.isArray(parsed)) {
      const set = new Set(moods);
      const cleaned = clauses.map((_, i) => {
        const id = (parsed[i] || "").toString().trim().toLowerCase();
        return set.has(id) ? id : "reflective";
      });
      res.status(200).json({ moods: cleaned });
    } else {
      // Couldn't parse — hand the raw text back; the client will try.
      res.status(200).json({ raw: text });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
