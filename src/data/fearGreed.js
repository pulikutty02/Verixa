import { fetchJson } from '../utils/http.js';
import { cached } from '../utils/cache.js';

// Crypto Fear & Greed Index — free, no key, no rate-limit issues.
// Used as one macro-sentiment input; most relevant to BTC/ETH/SOL/BNB
// but also included as a general risk-appetite gauge for other assets.
export async function getFearGreed(env){
  return cached(env, 'macro:feargreed', 1800, async () => {
    const json = await fetchJson('https://api.alternative.me/fng/?limit=1');
    const item = json && json.data && json.data[0];
    if(!item) throw new Error('no fear/greed data');
    return { value: Number(item.value), label: item.value_classification, timestamp: Number(item.timestamp) * 1000 };
  });
}
