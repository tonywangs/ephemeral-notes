# Wisp

An ephemeral, mood-colored journaling app. You write **forward only** — as you type,
your past words rise, blur, and fade away, so you can't rabbit-hole on what you already
wrote. Each clause is read for its emotional tone and blooms into a color (anger → red,
sadness → deep blue, hope → green, joy → gold, and so on). Everything you write is kept
in the **Archive**, where past entries become fully visible again.

## How mood detection works — a 3-tier cascade

Wisp tries these in order, falling through automatically:

1. **`window.claude`** — the built-in AI, available only in the hosted preview.
2. **`POST /api/classify`** — a serverless function (`api/classify.js`) that calls
   Anthropic using `ANTHROPIC_API_KEY` from the environment. **This is what runs when you
   deploy to Vercel or run `vercel dev` locally.** Your key stays server-side and never
   reaches the browser.
3. **Offline lexicon** — a keyword classifier (`mood.js` → `fallbackClassify`). Always
   works, no AI and no key. This is what you get from a plain static server.

## Run it locally

The app loads its `.jsx` components at runtime, which browsers fetch over HTTP — so you
can't just double-click `Wisp.html` (a `file://` URL is blocked by CORS). You have two
options:

### A) With real AI (recommended) — `vercel dev`

```bash
npm i -g vercel          # once
cp .env.example .env     # then paste your real ANTHROPIC_API_KEY into .env
vercel dev               # serves the app AND the /api/classify function
# open the URL it prints (e.g. http://localhost:3000/Wisp.html)
```

### B) No key, lexicon only — any static server

```bash
python3 -m http.server 8000
# open http://localhost:8000/Wisp.html  (mood coloring uses the offline lexicon)
```

## Deploy to Vercel

1. Push this folder to GitHub (below) and import it at [vercel.com/new](https://vercel.com/new).
2. In **Project Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (and optionally
   `ANTHROPIC_MODEL`, default `claude-haiku-4-5`).
3. Deploy. The `api/classify.js` function is picked up automatically; the app uses tier 2.

> Get an API key at <https://console.anthropic.com/>. Never commit `.env` — it's gitignored.

## Files

| File | Role |
|------|------|
| `Wisp.html` | Entry point — styles + script loading |
| `app.jsx` | App shell, views, persistence, Tweaks panel |
| `writingCanvas.jsx` | The ephemeral writing surface (rise / blur / fade) |
| `archive.jsx` | Past-entry browser |
| `moodWeather.jsx` | Emotional "weather" bar + headline |
| `mood.js` | Mood palette, colors, 3-tier classifier |
| `textModel.js` | Tokenizing + clause segmentation |
| `soundEngine.js` | Gentle typing ticks + mood chimes |
| `tweaks-panel.jsx` | Live tweak controls |
| `api/classify.js` | Serverless mood classifier (uses `ANTHROPIC_API_KEY`) |

All journal data lives in your browser's `localStorage` — nothing leaves your machine.

## Push to GitHub

```bash
git init
git add .
git commit -m "Wisp — ephemeral mood journaling"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
