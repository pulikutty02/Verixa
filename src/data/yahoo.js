import { fetchJson } from '../utils/http.js';

export function aggregateCandles(candles, factor){
  if(factor <= 1) return candles;
  const out = [];
  for(let i=0;i<candles.length;i+=factor){
    const chunk = candles.slice(i, i+factor);
    if(!chunk.length) continue;
    out.push({
      t: chunk[0].t, o: chunk[0].o,
      h: Math.max(...chunk.map(c=>c.h)),
      l: Math.min(...chunk.map(c=>c.l)),
      c: chunk[chunk.length-1].c,
    });
  }
  return out;
}

// Cloudflare Workers call Yahoo directly server-side — no CORS proxy needed
// (that hack only existed because the old code ran in the browser).
export async function fetchYahooCandles(ySymbol, interval, range){
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=${interval}&range=${range}`;
  const json = await fetchJson(url);
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  if(!result) throw new Error('no yahoo data for ' + ySymbol);
  const ts = result.timestamp || [];
  const q = result.indicators.quote[0];
  const candles = ts
    .map((t,i) => ({ t: t*1000, o:q.open[i], h:q.high[i], l:q.low[i], c:q.close[i] }))
    .filter(c => c.c != null && c.h != null && c.l != null);
  if(candles.length < 5) throw new Error('yahoo candles too short for ' + ySymbol);
  return candles;
}

export async function fetchYahooCandlesForTf(ySymbol, tf){
  let candles = await fetchYahooCandles(ySymbol, tf.yahoo.interval, tf.yahoo.range);
  if(tf.yahoo.agg) candles = aggregateCandles(candles, tf.yahoo.agg);
  return candles;
}

export async function fetchYahooQuote(ySymbol){
  const candles = await fetchYahooCandles(ySymbol, '1d', '5d');
  const last = candles.at(-1), prev = candles.at(-2) || last;
  return { price: last.c, prevClose: prev.c, changePct: ((last.c - prev.c) / prev.c) * 100 };
}
