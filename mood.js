// mood.js — emotional palette, color computation, and real AI classification.
// Exposes globals: MOODS, MOOD_MAP, moodColor, moodAmbient, classifyClauses.
(function () {
  // 10 nuanced moods. Hues spaced around the wheel; lightness/chroma tuned so
  // each reads as colored text on a near-white calm canvas without shouting.
  // light = base OKLCH lightness, chroma = base chroma at intensity 1.
  const MOODS = [
    { id: "anger",       label: "Anger",       hue: 26,  light: 0.56, chroma: 0.17 },
    { id: "gratitude",   label: "Gratitude",   hue: 58,  light: 0.62, chroma: 0.14 },
    { id: "joy",         label: "Joy",         hue: 92,  light: 0.66, chroma: 0.15 },
    { id: "hope",        label: "Hope",        hue: 150, light: 0.62, chroma: 0.13 },
    { id: "calm",        label: "Calm",        hue: 196, light: 0.60, chroma: 0.10 },
    { id: "sadness",     label: "Sadness",     hue: 248, light: 0.50, chroma: 0.13 },
    { id: "fear",        label: "Fear",        hue: 286, light: 0.46, chroma: 0.12 },
    { id: "anxiety",     label: "Anxiety",     hue: 318, light: 0.55, chroma: 0.14 },
    { id: "tenderness",  label: "Tenderness",  hue: 356, light: 0.64, chroma: 0.12 },
    { id: "reflective",  label: "Reflective",  hue: 250, light: 0.52, chroma: 0.012 },
  ];
  const MOOD_MAP = {};
  MOODS.forEach((m) => (MOOD_MAP[m.id] = m));

  // Text color for a mood at a given intensity (0.3..1.6 typical) and theme.
  // dark=true lifts lightness so colors glow on a dark canvas.
  function moodColor(id, intensity, dark) {
    const m = MOOD_MAP[id] || MOOD_MAP.reflective;
    const inten = intensity == null ? 1 : intensity;
    let L = m.light;
    if (dark) L = Math.min(0.82, L + 0.18);
    const C = (m.chroma * inten).toFixed(3);
    return `oklch(${L} ${C} ${m.hue})`;
  }

  // Very faint ambient wash color for the room background.
  function moodAmbient(id, dark) {
    const m = MOOD_MAP[id] || MOOD_MAP.reflective;
    const L = dark ? 0.30 : 0.93;
    const C = dark ? 0.045 : 0.030;
    return `oklch(${L} ${C} ${m.hue})`;
  }

  // ---- Offline fallback lexicon -----------------------------------------
  // Used when window.claude isn't available (e.g. running the app locally) or
  // when an AI call fails. Keyword scoring per mood; best score wins.
  const LEXICON = {
    anger:      ["angry","anger","furious","fury","mad","rage","hate","hated","annoyed","irritated","frustrated","frustrating","resent","pissed","boil","unfair","fed up","sick of","livid"],
    gratitude:  ["grateful","gratitude","thankful","thanks","thank you","blessed","appreciate","appreciated","lucky","fortunate"],
    joy:        ["happy","happiness","joy","joyful","delighted","excited","glad","wonderful","great","amazing","smile","smiling","laugh","laughing","fun","thrilled","bright","celebrate"],
    hope:       ["hope","hopeful","optimistic","better","tomorrow","looking forward","will be","can do","someday","forward","possible","light","believe"],
    calm:       ["calm","peace","peaceful","quiet","still","breathe","breathing","settled","ease","relax","relaxed","serene","content","rest","slow"],
    sadness:    ["sad","sadness","down","blue","cry","crying","tears","lonely","loneliness","lost","empty","miss","missing","grief","grieve","hurt","ache","aching","sorrow","weary","heavy","alone"],
    fear:       ["afraid","scared","fear","fearful","terrified","dread","dreading","panic","threat","danger","frightened","horror"],
    anxiety:    ["anxious","anxiety","worried","worry","worrying","nervous","stress","stressed","overwhelmed","tense","uneasy","restless","racing","spiraling","on edge"],
    tenderness: ["love","loved","loving","dear","tender","warm","warmth","soft","care","caring","hug","gentle","cherish","sweet","affection","close"],
    reflective: ["think","thinking","wonder","wondering","remember","realize","realized","notice","noticed","maybe","perhaps","suppose","consider","seems","question"],
  };
  function fallbackClassify(clause) {
    const s = " " + clause.toLowerCase().replace(/[^a-z\s]/g, " ") + " ";
    let bestId = "reflective", best = 0;
    for (const id in LEXICON) {
      let score = 0;
      for (const w of LEXICON[id]) {
        if (w.indexOf(" ") >= 0) { if (s.indexOf(" " + w + " ") >= 0 || s.indexOf(" " + w) >= 0) score += 1; }
        else if (s.indexOf(" " + w + " ") >= 0) score += 1;
      }
      if (id !== "reflective" && score > best) { best = score; bestId = id; }
    }
    return best > 0 ? bestId : "reflective";
  }

  // ---- Classification: 3-tier cascade -----------------------------------
  //   1. window.claude       — built-in AI (this hosted preview only)
  //   2. POST /api/classify  — your serverless fn, backed by ANTHROPIC_API_KEY
  //   3. offline lexicon     — always works, no AI / no key
  const _cache = new Map();
  let _serverlessDown = false; // once /api/classify proves absent, stop retrying

  function buildPrompt(need) {
    const ids = MOODS.map((m) => m.id).join(", ");
    const numbered = need.map((c, i) => `${i + 1}. ${c}`).join("\n");
    return (
      `You are an emotion classifier for a journaling app. For each numbered fragment ` +
      `of someone's private writing, choose the single mood that best matches its emotional tone.\n\n` +
      `Allowed moods (use these exact ids): ${ids}.\n` +
      `Use "reflective" for neutral, contemplative, or factual fragments.\n\n` +
      `Fragments:\n${numbered}\n\n` +
      `Respond with ONLY a JSON array of ${need.length} lowercase mood ids, in order. ` +
      `Example: ["joy","sadness","reflective"]. No prose.`
    );
  }

  function parseIds(raw, n) {
    const match = String(raw).match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match ? match[0] : raw);
    if (!Array.isArray(arr) || arr.length < n) throw new Error("bad shape");
    return arr.slice(0, n).map((v) => {
      const id = (v || "").toString().trim().toLowerCase();
      return MOOD_MAP[id] ? id : "reflective";
    });
  }

  // Tier 1
  async function viaBuiltin(need) {
    const raw = await window.claude.complete(buildPrompt(need));
    return parseIds(raw, need.length);
  }

  // Tier 2 — talks to /api/classify (see api/classify.js). The server may return
  // either {moods:[...]} (already parsed) or {raw:"..."} (model text to parse).
  async function viaServerless(need) {
    const r = await fetch("/api/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clauses: need, moods: MOODS.map((m) => m.id) }),
    });
    if (!r.ok) throw new Error("serverless " + r.status);
    const data = await r.json();
    if (Array.isArray(data.moods)) {
      if (data.moods.length < need.length) throw new Error("bad shape");
      return data.moods.slice(0, need.length).map((v) => {
        const id = (v || "").toString().trim().toLowerCase();
        return MOOD_MAP[id] ? id : "reflective";
      });
    }
    return parseIds(data.raw, need.length);
  }

  async function classifyNeed(need) {
    if (window.claude && typeof window.claude.complete === "function") {
      try { return await viaBuiltin(need); } catch (e) {}
    }
    if (!_serverlessDown) {
      try { return await viaServerless(need); }
      catch (e) {
        // network error / 404 / 405 -> no endpoint here; stop trying it.
        if (!e || !String(e.message).startsWith("serverless 5")) _serverlessDown = true;
      }
    }
    return need.map(fallbackClassify);
  }

  // Takes an array of clause strings, returns an array of mood ids (same order).
  async function classifyClauses(clauses) {
    const out = new Array(clauses.length).fill(null);
    const need = [];
    const needIdx = [];
    clauses.forEach((c, i) => {
      const key = c.trim().toLowerCase();
      if (!key) { out[i] = "reflective"; return; }
      if (_cache.has(key)) { out[i] = _cache.get(key); return; }
      need.push(c.trim());
      needIdx.push(i);
    });
    if (!need.length) return out;

    const ids = await classifyNeed(need);
    need.forEach((c, i) => {
      const id = MOOD_MAP[ids[i]] ? ids[i] : "reflective";
      _cache.set(c.toLowerCase(), id);
      out[needIdx[i]] = id;
    });
    for (let i = 0; i < out.length; i++) if (out[i] == null) out[i] = "reflective";
    return out;
  }

  Object.assign(window, { MOODS, MOOD_MAP, moodColor, moodAmbient, classifyClauses, fallbackClassify });
})();
