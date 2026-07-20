import { MARKETS, CATS, findMarket } from '../config/markets.js';
import { TIMEFRAMES, TIMEFRAME_ORDER } from '../config/timeframes.js';
import { buildFullReport } from '../analysis/report.js';
import { getCandles } from '../data/candles.js';
import { getNewsForAsset } from '../analysis/news.js';
import { getMacroOverlay } from '../analysis/macro.js';
import { NEWS_QUERY } from '../config/markets.js';
import { fetchCoinGeckoSimplePrice } from '../data/crypto.js';
import { fetchJson } from '../utils/http.js';
import { cached } from '../utils/cache.js';

function json(data, status=200, extraHeaders={}){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type':'application/json; charset=utf-8', ...extraHeaders },
  });
}

function corsHeaders(env, origin){
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function handleApi(request, env, url){
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(env, origin);

  if(request.method === 'OPTIONS') return new Response(null, { status:204, headers: cors });

  const path = url.pathname;

  try{
    if(path === '/api/markets'){
      return json({ markets: MARKETS, categories: CATS, timeframes: TIMEFRAME_ORDER.map(k => TIMEFRAMES[k]) }, 200, cors);
    }

    if(path === '/api/analyze'){
      const marketId = url.searchParams.get('market') || url.searchParams.get('symbol');
      const tfKey = url.searchParams.get('tf') || '1h';
      const market = findMarket(marketId);
      if(!market) return json({ error:`Unknown market "${marketId}"` }, 400, cors);
      if(!TIMEFRAMES[tfKey]) return json({ error:`Unknown timeframe "${tfKey}"` }, 400, cors);
      const report = await buildFullReport(env, market, tfKey);
      return json(report, 200, cors);
    }

    if(path === '/api/price'){
      const marketId = url.searchParams.get('market') || url.searchParams.get('symbol');
      const market = findMarket(marketId);
      if(!market) return json({ error:`Unknown market "${marketId}"` }, 400, cors);
      const candles = await getCandles(env, market, '1d');
      const last = candles.at(-1), prev = candles.at(-2) || last;
      return json({ market: market.id, price:last.c, prevClose:prev.c, changePct: ((last.c-prev.c)/prev.c)*100 }, 200, cors);
    }

    if(path === '/api/news'){
      const marketId = url.searchParams.get('market') || url.searchParams.get('symbol');
      const market = findMarket(marketId);
      if(!market) return json({ error:`Unknown market "${marketId}"` }, 400, cors);
      const news = await getNewsForAsset(env, market, NEWS_QUERY[market.id] || market.desc);
      return json(news, 200, cors);
    }

    if(path === '/api/macro'){
      const macro = await getMacroOverlay(env);
      return json(macro, 200, cors);
    }

    // Powers the site's decorative mini-ticker — previously called CoinGecko
    // directly from the browser; now routed through the shared backend.
    if(path === '/api/ticker'){
      const data = await cached(env, 'ticker:btc-eth-sol', 60, () => fetchCoinGeckoSimplePrice(['bitcoin','ethereum','solana']));
      return json(data, 200, cors);
    }

    // Powers the neural-core widget's "market breadth" ambient state.
    if(path === '/api/global'){
      const data = await cached(env, 'cg:global', 120, () => fetchJson('https://api.coingecko.com/api/v3/global'));
      return json(data, 200, cors);
    }

    return json({ error:'Not found', routes:['/api/markets','/api/analyze?market=&tf=','/api/price?market=','/api/news?market=','/api/macro'] }, 404, cors);
  }catch(e){
    return json({ error:'Internal error', message: String(e && e.message || e) }, 500, cors);
  }
}
