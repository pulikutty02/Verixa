import { fetchJson } from '../utils/http.js';
import { aggregateCandles } from './yahoo.js';

export async function fetchBinanceCandles(symbol, interval, limit){
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const arr = await fetchJson(url);
  if(!Array.isArray(arr) || arr.length < 5) throw new Error('binance empty for ' + symbol);
  return arr.map(k => ({ t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4] }));
}

export async function fetchCoinGeckoCandles(gId, days){
  const url = `https://api.coingecko.com/api/v3/coins/${gId}/ohlc?vs_currency=usd&days=${days}`;
  const arr = await fetchJson(url);
  if(!Array.isArray(arr) || arr.length < 5) throw new Error('coingecko empty for ' + gId);
  return arr.map(a => ({ t:a[0], o:a[1], h:a[2], l:a[3], c:a[4] }));
}

export async function fetchCryptoCandlesForTf(market, tf){
  try{
    return await fetchBinanceCandles(market.binSymbol, tf.binance, 320);
  }catch(e){
    const raw = await fetchCoinGeckoCandles(market.gId, tf.cg.days);
    return aggregateCandles(raw, tf.cg.agg);
  }
}

export async function fetchCoinGeckoSimplePrice(gIds){
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${gIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  return fetchJson(url);
}
