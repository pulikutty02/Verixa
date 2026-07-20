# Deploying the Verixa Backend (Telegram bot + website API, one worker)

This single Cloudflare Worker now replaces the old `verixa-telegram-worker`
**and** the client-side data-fetching code that used to live in
`ai-agent.html`. Both the Telegram bot and the website call the exact same
functions server-side — one data pipeline, one scoring engine.

## 0. Prerequisites
- Node.js installed locally (for the `wrangler` CLI).
- A free Cloudflare account.
- A Telegram bot token from @BotFather (same as before).

## 1. Install Wrangler & log in
```
npm install -g wrangler
wrangler login
```

## 2. Create the KV namespace (used to cache candles/news/macro data)
```
cd verixa-backend
wrangler kv namespace create VERIXA_CACHE
wrangler kv namespace create VERIXA_CACHE --preview
```
Copy the two `id` values it prints into `wrangler.toml`, replacing
`REPLACE_WITH_KV_NAMESPACE_ID` and `REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID`.

## 3. Set secrets
```
wrangler secret put TELEGRAM_BOT_TOKEN
```
Paste the token from BotFather when prompted.

Optional (free-tier keys — the backend works without them, it just skips
the series that need a key; see "Data sources" below):
```
wrangler secret put FRED_API_KEY
```

## 4. Update allowed origins
In `wrangler.toml`, edit `ALLOWED_ORIGINS` under `[vars]` to match your real
website domain(s) exactly (scheme + host, no trailing slash).

## 5. Deploy
```
wrangler deploy
```
This prints your worker URL, e.g. `https://verixa-backend.<subdomain>.workers.dev`.

## 6. Point Telegram at the worker
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://verixa-backend.<subdomain>.workers.dev&allowed_updates=["message","callback_query"]
```
You should see `{"ok":true,"result":true,...}`.

Optional but recommended — lock the webhook down with a shared secret so
random POSTs to your worker URL can't trigger it:
```
wrangler secret put TELEGRAM_WEBHOOK_SECRET
```
then re-run `setWebhook` adding `&secret_token=<same value>`.

## 7. Point the website at the worker
Open `ai-agent.html` and set the constant near the top of the inline
`<script>` block:
```js
const VERIXA_API_BASE = window.VERIXA_API_BASE || 'https://verixa-backend.<subdomain>.workers.dev';
```
Replace the URL with your real worker URL (or set `window.VERIXA_API_BASE`
in an earlier `<script>` tag if you prefer not to edit the file per-environment).

## 8. Test
Telegram: send `/start`, `/analyze`, tap through category → market → timeframe.
Website: open `ai-agent.html`, pick a market + timeframe, click Analyze.
API directly: `curl https://verixa-backend.<subdomain>.workers.dev/api/markets`

---

## What changed vs the old two-project setup
- **One worker, one codebase.** `verixa-telegram-worker` is retired; its
  logic now lives in `verixa-backend/src/telegram/*`, sharing the analysis
  engine with the website API in `verixa-backend/src/routes/api.js`.
- **The website no longer fetches Yahoo/Binance/CoinGecko/Google News
  directly from the browser**, and the CORS-proxy hacks (`corsproxy.io`,
  `allorigins.win`) are gone. It calls `/api/*` on the worker instead.
- **The Telegram timeframe bug is fixed.** `/analyze` now shows category →
  market → timeframe buttons, and the tapped timeframe (`callback_data`
  `tf:<marketId>:<tfKey>`) is threaded directly into `buildFullReport()` —
  there's no code path left that silently substitutes the 1H default.
- **KV caching** means the bot and website share cached candles/news/macro
  data (TTL matched to each timeframe), instead of two clients independently
  hammering the same free-tier APIs.
- **Cron trigger** (every 10 min) keeps the six most common symbols' 1H
  cache warm.

## Data sources — what's wired in, and what's realistically out of scope

**No key required, integrated now:**
- Yahoo Finance (FX, metals, indices, energy futures)
- Binance + CoinGecko (crypto, with automatic fallback)
- Google News RSS (headline sentiment, dedup, impact classification)
- Alternative.me Fear & Greed Index
- CBOE VIX, US 10-Year Treasury yield, DXY (all via Yahoo tickers, used as
  the macro overlay)

**Free key required (you provide it, wired in but off by default):**
- FRED (CPI, Fed Funds Rate, unemployment, GDP, PPI) — `FRED_API_KEY`.
  Sign-up is instant and free: https://fred.stlouisfed.org/docs/api/api_key.html
- Financial Modeling Prep, Finnhub, Alpha Vantage, Twelve Data, Trading
  Economics were requested but are **not wired in this pass** — they're
  mostly redundant with what Yahoo/FRED already cover for the FX/metals/
  crypto/index symbols this platform trades, and each adds its own
  rate-limit and key-management surface. Wiring one in later is a single
  new file under `src/data/`, following the pattern in `src/data/fred.js`.

**Not integrated, and why:**
- **OpenBB** is a Python package — it can't run inside a Cloudflare
  Worker's JS/V8 runtime. Using it would mean standing up a separate
  Python service, which is a different infrastructure decision than "add
  a data source."
- **CFTC Commitment of Traders** is a weekly bulk file (not a clean REST
  API) and would need its own parser + weekly cron; worth a dedicated pass
  rather than folding it in here.
- **ECB, World Bank, BLS, IMF, SEC EDGAR** are legitimate free sources but
  aren't relevant to this platform's actual symbol list (FX majors,
  metals, index futures, crypto) the way DXY/VIX/yields/CPI already are —
  they'd mostly add scope without changing any report's output.
- **finance.worldmonitor.app / koala73/worldmonitor / BB-Terminal** are
  large standalone applications (worldmonitor: 65+ providers, its own
  Next.js/TypeScript stack) — reusing their *code* isn't practical inside
  this single-file Worker, and reusing their *hosted APIs* would make
  Verixa depend on a third party's uptime and terms rather than direct
  free sources. The pattern they use (aggregate many free feeds behind one
  cache layer) is exactly what this backend now does.

**Also out of scope this pass:** `/alerts` and `/watchlist` (need
persistent per-user storage — Cloudflare D1 is the natural next step),
scheduled daily digests (the cron trigger exists and is the right place to
add this), and a full economic calendar (would need a paid calendar
provider or a scraper — FRED release dates are a partial free substitute
and are already surfaced in the macro notes when `FRED_API_KEY` is set).
