/* =====================================================================
   HANIRA — Hyper-Adaptive Neural Intelligence & Research Assistant
   Front-end intent-routing engine.

   IMPORTANT — READ THIS BEFORE DEPLOYING:
   The existing Verixa backend (Cloudflare Worker) is a RULE-BASED
   analysis engine — /api/analyze runs real technical/macro/news scoring
   (see src/analysis/report.js) but there is no general-purpose language
   model wired in anywhere in the backend you provided. So HANIRA here
   works like a smart *router*, not a free-form LLM:
     - It parses what you typed for an intent (price / analysis / news /
       macro / company+product FAQ / finance-term glossary).
     - It resolves a market symbol and a timeframe from your wording.
     - It calls the real backend endpoint for that intent and renders
       the real numbers it gets back.
     - For general finance/macro concepts it isn't a live number for
       (e.g. "what is CPI"), it answers from a small built-in glossary.
   This means HANIRA never invents a price or a bias — every number you
   see is a genuine API response. It also means it will occasionally say
   "I'm not sure how to help with that" for questions far outside its
   scope, rather than making something up.

   To upgrade HANIRA to genuinely open-ended conversation (any finance
   question, phrased any way), the missing piece is a real LLM call —
   wire a new Worker route (e.g. POST /api/ask) that forwards the
   question plus live report JSON as context to an LLM API, and swap
   the fallback branch at the bottom of routeIntent() to call it instead
   of the static response. Everything else here — symbol/timeframe
   parsing, the data fetchers — is reusable as-is for that upgrade.
   ===================================================================== */

const HANIRA_API_BASE = window.VERIXA_API_BASE || 'https://verixa-backend.thepipsociety82.workers.dev'; // ← same live Cloudflare Worker used by ai-agent.html and the Telegram bot (single source of truth: window.VERIXA_API_BASE, set in script.js)

/* ── Market alias table — mirrors src/config/markets.js exactly so
   HANIRA and the backend never disagree on what a symbol means. ── */
const MARKETS = [
  { id:'XAUUSD', label:'Spot Gold',      aliases:['gold','xau','xauusd','spot gold'] },
  { id:'XAGUSD', label:'Spot Silver',    aliases:['silver','xag','xagusd'] },
  { id:'CL',     label:'Crude Oil',      aliases:['oil','wti','crude','cl'] },
  { id:'DXY',    label:'Dollar Index',   aliases:['dxy','dollar index','usd index'] },
  { id:'EURUSD', label:'Euro / Dollar',  aliases:['eurusd','euro','eur/usd'] },
  { id:'GBPUSD', label:'Pound / Dollar', aliases:['gbpusd','cable','pound','gbp/usd'] },
  { id:'USDJPY', label:'Dollar / Yen',   aliases:['usdjpy','yen','usd/jpy'] },
  { id:'GBPAUD', label:'Pound / Aussie', aliases:['gbpaud','gbp/aud'] },
  { id:'GBPCAD', label:'Pound / Loonie', aliases:['gbpcad','gbp/cad'] },
  { id:'GBPJPY', label:'Pound / Yen',    aliases:['gbpjpy','gbp/jpy'] },
  { id:'EURGBP', label:'Euro / Pound',   aliases:['eurgbp','eur/gbp'] },
  { id:'USDCHF', label:'Dollar / Franc', aliases:['usdchf','usd/chf'] },
  { id:'AUDCAD', label:'Aussie / Loonie',aliases:['audcad','aud/cad'] },
  { id:'CHFJPY', label:'Franc / Yen',    aliases:['chfjpy','chf/jpy'] },
  { id:'AUDCHF', label:'Aussie / Franc', aliases:['audchf','aud/chf'] },
  { id:'EURCHF', label:'Euro / Franc',   aliases:['eurchf','eur/chf'] },
  { id:'GBPCHF', label:'Pound / Franc',  aliases:['gbpchf','gbp/chf'] },
  { id:'AUDJPY', label:'Aussie / Yen',   aliases:['audjpy','aud/jpy'] },
  { id:'EURAUD', label:'Euro / Aussie',  aliases:['euraud','eur/aud'] },
  { id:'USDCAD', label:'Dollar / Loonie',aliases:['usdcad','usd/cad'] },
  { id:'CADJPY', label:'Loonie / Yen',   aliases:['cadjpy','cad/jpy'] },
  { id:'EURCAD', label:'Euro / Loonie',  aliases:['eurcad','eur/cad'] },
  { id:'NQ',     label:'Nasdaq Futures', aliases:['nasdaq','nas100','nq'] },
  { id:'ES',     label:'S&P Futures',    aliases:['spx','sp500','s&p','es','spx500'] },
  { id:'YM',     label:'Dow Futures',    aliases:['dow','us30','ym'] },
  { id:'BTC',    label:'Bitcoin',        aliases:['btc','bitcoin'] },
  { id:'ETH',    label:'Ethereum',       aliases:['eth','ethereum'] },
  { id:'SOL',    label:'Solana',         aliases:['sol','solana'] },
  { id:'BNB',    label:'BNB',            aliases:['bnb','binance coin'] },
];

/* ── Timeframes — the FULL set, never restricted to one default. ── */
const TIMEFRAMES = [
  { id:'1m',  label:'1 Minute', aliases:['1m','1 min','1 minute','1min','one minute'] },
  { id:'5m',  label:'5 Minute', aliases:['5m','5 min','5 minute','5min'] },
  { id:'15m', label:'15 Minute',aliases:['15m','15 min','15 minute','15min'] },
  { id:'1h',  label:'1 Hour',   aliases:['1h','1hr','1 hour','hourly','60m'] },
  { id:'4h',  label:'4 Hour',   aliases:['4h','4hr','4 hour','four hour'] },
  { id:'1d',  label:'Daily',    aliases:['1d','daily','day','1 day'] },
];
const DEFAULT_TF = '4h';

/* ── Static knowledge base: company / founder / product / pricing / docs.
   Kept accurate to the real site content — no invented numbers, no
   invented pricing tiers (Verixa doesn't publish one; access is
   request-based through the founder). ── */
const KB = [
  {
    keys:['what is verixa','about verixa','who is verixa','company','tell me about verixa'],
    reply:"Verixa is a financial technology company that builds professional trading technology — the Verixa 4C Model, market analytics, and me, HANIRA. It was founded on a simple idea: apply real software-engineering rigor (clean architecture, transparent methodology, no black boxes) to market analysis, instead of chasing hype. Tools analyze and structure — the decision always stays with the trader."
  },
  {
    keys:['founder','who founded','who made this','mohamed hanas','who built','who created you','who owns'],
    reply:"Verixa was founded by Mohamed Hanas, a software engineer with a background in enterprise integrations, cloud technologies, automation, and machine learning pipelines. He built Verixa to apply the same engineering discipline he uses in production software to financial market analysis. You can read more on the Founder page, or reach him directly through the Contact page."
  },
  {
    keys:['4c model','four c','4c','flagship indicator','what is the indicator'],
    reply:"The Verixa 4C Model is our flagship TradingView indicator, now on V2. It screens the market through four sequential stages — Context, Confluence, Confirmation, Conviction — before surfacing a high-probability Buy/Sell read, instead of reacting to one lone technical condition. It ships alongside the Multi-Symbol Confluence Scanner. See the 4C Model page for the full breakdown."
  },
  {
    keys:['pricing','price of the indicator','cost','how much','subscription'],
    reply:"Verixa doesn't run a public price list — access to the Intelligence Suite is request-based. Submit the Contact form and the founder will follow up personally, usually within a business day, with current access details."
  },
  {
    keys:['features','what can it do','what does it do','capabilities'],
    reply:"The 4C Model covers market structure analysis (BOS/CHoCH detection), multi-timeframe trend bias, institutional order block and fair value gap detection, configurable smart alerts, and clean chart visualization. It runs natively inside TradingView — no external app required."
  },
  {
    keys:['documentation','docs','how does it work','how do i use it','methodology'],
    reply:"Every Verixa tool follows the same architecture: raw price data in, structure detection, multi-timeframe synthesis, then a visual output with alerts — the trader keeps full decision authority at every stage. The 4C Model page walks through this analytical architecture step by step, and I can also run a live read for any market and timeframe right here if that's more useful."
  },
  {
    keys:['is this financial advice','investment advice','signal service','are you a signal'],
    reply:"No. I read live data and structure it into a report — bias, key levels, confidence, and context — but that's analysis, not a signal or investment advice. Verixa's tools present information; every trading decision, and the risk that comes with it, stays entirely with you."
  },
  {
    keys:['what is hanira','who are you','what are you','introduce yourself'],
    reply:"I'm HANIRA — the Hyper-Adaptive Neural Intelligence & Research Assistant. I'm Verixa's live market analyst: ask me for a read on Gold, FX, Crypto, Indices or Commodities on any timeframe from 1-minute to Daily, ask about macro conditions or news, or ask about Verixa itself — company, founder, the 4C Model, or how to get access."
  },
  {
    keys:['contact','get in touch','reach','email','talk to founder'],
    reply:"You can reach the team through the Contact page, or email mohamedhanaskkl@gmail.com directly. The founder responds personally, typically within one business day."
  },
];

/* ── Small finance/macro glossary — general education, not advice. ── */
const GLOSSARY = [
  { keys:['cpi','consumer price index'], reply:"CPI (Consumer Price Index) measures the average change in prices consumers pay for a basket of goods and services over time — it's the most-watched gauge of inflation. Hotter-than-expected CPI prints typically pressure risk assets and boost the dollar, on expectations central banks will hold rates higher for longer." },
  { keys:['nfp','non-farm payrolls','non farm payrolls','jobs report'], reply:"NFP (Non-Farm Payrolls) is the US monthly jobs report — the change in employed people, excluding farm workers, government and a few other categories. It's released the first Friday of most months and is one of the highest-volatility data points in FX and indices." },
  { keys:['fomc','federal reserve','fed meeting','rate decision'], reply:"The FOMC (Federal Open Market Committee) is the Fed body that sets US interest rate policy. Its decisions and the press conference that follows tend to be the biggest scheduled volatility event for the dollar, gold and global risk assets." },
  { keys:['interest rate','rate hike','rate cut'], reply:"Interest rates are the cost of borrowing money, set by central banks to manage inflation and growth. Rate hikes generally strengthen a currency and pressure gold/equities by raising the opportunity cost of holding non-yielding assets; cuts typically do the opposite." },
  { keys:['inflation'], reply:"Inflation is the rate at which the general price level rises, eroding purchasing power over time. Central banks target moderate inflation (commonly ~2%); persistently high inflation usually triggers tighter monetary policy, which reshapes currency, bond and equity pricing." },
  { keys:['yield curve','bond yield','10 year yield','us10y'], reply:"The yield curve plots interest rates across bond maturities. Rising yields (especially the US 10-Year) typically strengthen the dollar and pressure gold; an inverted curve (short-term yields above long-term) has historically preceded recessions." },
  { keys:['dxy','dollar index'], reply:"DXY (the US Dollar Index) measures the dollar against a basket of major currencies (mostly the euro). It's a key macro overlay for Gold and FX — a rising DXY usually correlates with pressure on XAUUSD and other dollar-denominated assets." },
  { keys:['vix','fear index','volatility index'], reply:"The VIX measures the market's expectation of 30-day S&P 500 volatility, derived from options pricing — often called the 'fear gauge'. Elevated VIX readings usually coincide with risk-off flows: equities and crypto weaken, while the dollar and sometimes gold firm up." },
  { keys:['fear and greed','fear & greed'], reply:"The Fear & Greed Index blends several market indicators into a single sentiment score from Extreme Fear to Extreme Greed. It's a contrarian-leaning gauge some traders use alongside — never instead of — structural analysis." },
  { keys:['risk on','risk off','risk-on','risk-off'], reply:"'Risk-on' describes conditions where investors favor higher-risk, higher-return assets (equities, crypto, high-beta FX); 'risk-off' is the flight to perceived safety (US dollar, gold, government bonds). Macro data surprises are the usual trigger for a shift between the two." },
  { keys:['bos','break of structure'], reply:"BOS (Break of Structure) is a market-structure concept: price closing beyond a prior significant swing high/low in the direction of the existing trend, confirming that trend is continuing." },
  { keys:['choch','change of character'], reply:"CHoCH (Change of Character) is the market-structure signal for a potential trend reversal — price breaking structure in the opposite direction to the prevailing trend, often the first clue a reversal may be underway." },
  { keys:['order block'], reply:"An order block is the last opposing candle before a strong, structural price move — read as a zone of concentrated institutional orders. Price often reacts when it revisits that zone later." },
  { keys:['fair value gap','fvg'], reply:"A Fair Value Gap (FVG) is a three-candle imbalance where price moved so fast it left a visible gap between candle wicks. These zones often get 'filled' (revisited) before price continues its move." },
  { keys:['atr','average true range'], reply:"ATR (Average True Range) measures recent volatility — the average size of a market's price swings over a lookback period. It's commonly used to size stops and position risk relative to how much a market is actually moving." },
  { keys:['rsi','relative strength index'], reply:"RSI (Relative Strength Index) is a momentum oscillator from 0–100. Readings above ~70 suggest a market may be overextended to the upside; below ~30 suggests the same to the downside — though in strong trends RSI can stay stretched for a while." },
  { keys:['macd'], reply:"MACD (Moving Average Convergence Divergence) tracks the relationship between two moving averages to gauge momentum and trend direction. A rising histogram generally reflects strengthening bullish momentum; a falling one, strengthening bearish momentum." },
];

/* ── Utilities ─────────────────────────────────────────────────────── */
function norm(s){ return (s || '').toLowerCase().trim(); }

function findMarket(text){
  const t = norm(text);
  let best = null, bestLen = 0;
  for(const m of MARKETS){
    for(const a of m.aliases){
      if(t.includes(a) && a.length > bestLen){ best = m; bestLen = a.length; }
    }
  }
  return best;
}

function findTimeframe(text){
  const t = norm(text);
  for(const tf of TIMEFRAMES){
    for(const a of tf.aliases){
      // word-boundary-ish match so "4h" doesn't match inside "usdchf"
      const re = new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`);
      if(re.test(t)) return tf.id;
    }
  }
  return null;
}

function findKbMatch(text, table){
  const t = norm(text);
  let best = null, bestLen = 0;
  for(const row of table){
    for(const k of row.keys){
      if(t.includes(k) && k.length > bestLen){ best = row; bestLen = k.length; }
    }
  }
  return best;
}

async function apiGet(path){
  const res = await fetch(`${HANIRA_API_BASE}${path}`, { headers:{ 'Accept':'application/json' } });
  if(!res.ok) throw new Error(`request failed: ${path}`);
  return res.json();
}

function pct(n){ return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

/* ── Response builders — every field here comes straight from the
   real backend response shape (see src/analysis/report.js). ── */
function renderAnalysis(report){
  const { market, tf, bias, scores, levels, outlook, why } = report;
  const biasWord = bias === 'BULLISH' ? 'bullish' : bias === 'BEARISH' ? 'bearish' : 'neutral / range-bound';
  const lines = [];
  lines.push(`<strong>${market.sym} · ${tf.full}</strong> — reading <strong>${biasWord}</strong>, confidence ${scores.confidence}%.`);
  lines.push(`Last close ${report.lastClose.toLocaleString(undefined,{maximumFractionDigits:market.dec})} (${pct(report.changePct)}). Risk regime: ${report.risk}.`);
  if(levels){
    lines.push(`Key levels — support ${fmtLvl(levels.support, market.dec)}, resistance ${fmtLvl(levels.resistance, market.dec)}, pivot ${fmtLvl(levels.pivot, market.dec)}.`);
  }
  lines.push(outlook.shortTerm);
  if(why && why.length){
    lines.push(`<em>Why:</em> ${why.slice(0, 3).join(' ')}`);
  }
  lines.push(`<span style="color:var(--ivory-faint); font-size:0.78rem;">${report.disclaimer}</span>`);
  return lines.join('<br><br>');
}
function fmtLvl(n, dec){ return n == null || isNaN(n) ? '—' : n.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec}); }

function renderPrice(p, marketMeta){
  return `<strong>${p.market}</strong> is trading at <strong>${Number(p.price).toLocaleString(undefined,{maximumFractionDigits:5})}</strong> (${pct(p.changePct)} vs prior close).`;
}

function renderNews(news, marketLabel){
  if(!news.items || !news.items.length){
    return `No fresh headlines came back for ${marketLabel} right now — news carries no weight in the current read.`;
  }
  const top = news.items.slice(0, 4).map(i => `— ${i.title}${i.source ? ` <span style="color:var(--ivory-faint);">(${i.source})</span>` : ''}`).join('<br>');
  return `News sentiment for ${marketLabel} is <strong>${news.label}</strong> across ${news.dedupedCount} headlines (${news.breakingCount} breaking, ${news.highImpactCount} high-impact):<br>${top}`;
}

function renderMacro(macro){
  const rows = [];
  if(macro.dxy) rows.push(['DXY', `${macro.dxy.value.toFixed(2)} (${pct(macro.dxy.changePct)})`]);
  if(macro.vix) rows.push(['VIX', `${macro.vix.value.toFixed(2)} (${pct(macro.vix.changePct)})`]);
  if(macro.us10y) rows.push(['US 10Y', `${macro.us10y.value.toFixed(2)} (${pct(macro.us10y.changePct)})`]);
  if(macro.fearGreed) rows.push(['Fear &amp; Greed', String(macro.fearGreed.value ?? macro.fearGreed)]);
  const table = rows.length
    ? `<table>${rows.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`
    : '';
  const notes = macro.notes ? `<br>${Array.isArray(macro.notes) ? macro.notes.join(' ') : macro.notes}` : '';
  return `Macro overlay score: <strong>${macro.score}/100</strong>${notes}${table}`;
}

/* ── Main intent router ───────────────────────────────────────────── */
async function routeIntent(text, scopeTf){
  const t = norm(text);

  // 1) Greeting / capability question
  if(/^(hi|hey|hello|yo)\b/.test(t) || /what can you (do|help)/.test(t)){
    return "I'm HANIRA. Ask me for a live read on any market — Gold, FX, Crypto, Indices, Commodities — on any timeframe from 1-minute to Daily. I can also pull news sentiment, macro conditions (DXY, VIX, yields), explain a finance/macro term, or answer questions about Verixa itself.";
  }

  const market = findMarket(t);
  const tfFromText = findTimeframe(t);
  const tf = tfFromText || scopeTf || DEFAULT_TF;
  const tfMeta = TIMEFRAMES.find(x => x.id === tf);

  // 2) Price-only query
  if(market && /\b(price|trading at|quote|worth|how much is)\b/.test(t) && !/\b(bias|analysis|trend|forecast|setup|technical|4c|read|structure)\b/.test(t)){
    try{
      const p = await apiGet(`/api/price?market=${market.id}`);
      return renderPrice(p, market);
    }catch(e){
      return `I couldn't reach live pricing for ${market.label} just now — the backend may be unreachable from this preview. Point HANIRA_API_BASE in hanira-engine.js at your deployed Worker to enable this.`;
    }
  }

  // 3) News query
  if(/\b(news|headline|happening)\b/.test(t)){
    if(!market){
      return "Which market's news are you after — Gold, EURUSD, Bitcoin, or something else? Naming the symbol gets you deduplicated, sentiment-scored headlines.";
    }
    try{
      const news = await apiGet(`/api/news?market=${market.id}`);
      return renderNews(news, market.label);
    }catch(e){
      return `I couldn't pull news for ${market.label} just now — check that the backend is reachable from this preview.`;
    }
  }

  // 4) Macro query
  if(/\b(macro|risk.?on|risk.?off|dxy|vix|yields?|10.?year)\b/.test(t) && !market){
    try{
      const macro = await apiGet('/api/macro');
      return renderMacro(macro);
    }catch(e){
      return "I couldn't pull the macro overlay just now — check that the backend is reachable from this preview.";
    }
  }

  // 5) Market + analysis/bias query (any timeframe — never locked to 1H)
  if(market && (tfFromText || /\b(bias|analysis|analyze|trend|forecast|setup|technical|4c|read|structure|outlook)\b/.test(t) || /^(what'?s|whats|how'?s|hows)\b/.test(t))){
    try{
      const report = await apiGet(`/api/analyze?market=${market.id}&tf=${tf}`);
      return renderAnalysis(report);
    }catch(e){
      return `I couldn't run a live ${tfMeta.label} read on ${market.label} just now — check that the backend is reachable from this preview (see the note at the top of hanira-engine.js).`;
    }
  }

  // 6) Finance/macro glossary
  const glossaryHit = findKbMatch(t, GLOSSARY);
  if(glossaryHit) return glossaryHit.reply;

  // 7) Company / product / founder / pricing FAQ
  const kbHit = findKbMatch(t, KB);
  if(kbHit) return kbHit.reply;

  // 8) Market mentioned but no clear ask — offer the obvious next step
  if(market){
    return `I can pull a live ${tfMeta.label} read, the latest price, or news sentiment for ${market.label} — which would help? You can also just ask "what's the daily bias on ${market.id}" and I'll run it.`;
  }

  // 9) Fallback — honest about scope, no invented answer
  return "I'm not fully sure how to route that one yet. I'm best at: live market reads (any symbol, any timeframe 1m→Daily), news sentiment, macro conditions, finance/macro term definitions, and questions about Verixa, the 4C Model, or the founder. Try rephrasing, or ask me what I can do.";
}

window.HANIRA = { routeIntent, MARKETS, TIMEFRAMES, DEFAULT_TF, findMarket, findTimeframe };
