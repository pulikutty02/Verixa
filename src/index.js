import { handleTelegramUpdate } from './telegram/handlers.js';
import { handleApi } from './routes/api.js';
import { getCandles } from './data/candles.js';
import { MARKETS } from './config/markets.js';
import { DEFAULT_TF } from './config/timeframes.js';

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);

    if(url.pathname.startsWith('/api/')){
      return handleApi(request, env, url);
    }

    if(request.method === 'POST' && url.pathname === '/'){
      // Telegram webhook. Verify the secret token header if configured
      // (set via setWebhook's secret_token param + TELEGRAM_WEBHOOK_SECRET).
      if(env.TELEGRAM_WEBHOOK_SECRET){
        const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if(got !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status:403 });
      }
      let update;
      try{ update = await request.json(); }catch(e){ return new Response('bad request', { status:400 }); }
      await handleTelegramUpdate(env, update);
      return new Response('ok');
    }

    return new Response('Verixa backend is running. See /api/markets for the JSON API.', { status:200 });
  },

  // Keeps the hottest symbols' candle cache warm so the first user request
  // after a cache miss doesn't eat the full upstream latency, and gives a
  // natural home for future scheduled Telegram digests / alerts.
  async scheduled(event, env, ctx){
    const hot = MARKETS.slice(0, 6); // XAUUSD, XAGUSD, CL, DXY, EURUSD, GBPUSD
    await Promise.allSettled(hot.map(m => getCandles(env, m, DEFAULT_TF)));
  },
};
