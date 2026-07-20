import { fetchYahooCandlesForTf } from './yahoo.js';
import { fetchCryptoCandlesForTf } from './crypto.js';
import { TIMEFRAMES } from '../config/timeframes.js';
import { cached, cacheKey } from '../utils/cache.js';

// The single function every consumer (Telegram bot, website API, macro
// engine, cross-asset engine) calls to get OHLC candles for a symbol.
// Cached in KV keyed by symbol+timeframe so the bot and website share
// the exact same cached data and never disagree, and so we stay well
// inside free-tier rate limits on Yahoo/Binance/CoinGecko.
export async function getCandles(env, market, tfKey){
  const tf = TIMEFRAMES[tfKey];
  const key = cacheKey('candles', market.id, tfKey);
  return cached(env, key, tf.cacheTtl, async () => {
    if(market.src === 'cg') return fetchCryptoCandlesForTf(market, tf);
    return fetchYahooCandlesForTf(market.ySymbol, tf);
  });
}

export async function getCandlesForYahooSymbol(env, id, ySymbol, tfKey){
  const tf = TIMEFRAMES[tfKey];
  const key = cacheKey('candles-y', id, tfKey);
  return cached(env, key, tf.cacheTtl, () => fetchYahooCandlesForTf(ySymbol, tf));
}
