import { fetchText } from '../utils/http.js';
import { cached, cacheKey } from '../utils/cache.js';

const BULLISH_WORDS = ['rally','rallies','surge','surges','jump','jumps','gain','gains','gaining','rise','rises','rising','soar','soars','higher','strength','strengthens','beat','beats','optimism','optimistic','buy','buying','bullish','record high','climb','climbs','rebound','rebounds','upbeat','outperform','cut rates','dovish','stimulus'];
const BEARISH_WORDS = ['fall','falls','falling','drop','drops','plunge','plunges','decline','declines','slump','slumps','lower','weak','weakens','weakness','miss','misses','sell','selling','bearish','record low','tumble','tumbles','slide','slides','crash','crashes','pressure','pressured','downbeat','underperform','recession','fears','hawkish','rate hike','hike rates'];
const HIGH_IMPACT_WORDS = ['fed','fomc','rate decision','cpi','inflation','nonfarm','payrolls','jobs report','gdp','war','conflict','sanctions','opec','central bank','powell','ecb','boe','recession','crisis','default','emergency'];

function scoreHeadline(title){
  const t = title.toLowerCase();
  let score = 0;
  BULLISH_WORDS.forEach(w => { if(t.includes(w)) score += 1; });
  BEARISH_WORDS.forEach(w => { if(t.includes(w)) score -= 1; });
  return score;
}

function impactLevel(title){
  const t = title.toLowerCase();
  return HIGH_IMPACT_WORDS.some(w => t.includes(w)) ? 'high' : 'normal';
}

// Cheap similarity check for dedup: shares >= 60% of significant words.
function similar(a, b){
  const words = s => new Set(s.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const wa = words(a), wb = words(b);
  if(!wa.size || !wb.size) return false;
  let shared = 0;
  wa.forEach(w => { if(wb.has(w)) shared++; });
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

function dedupe(items){
  const out = [];
  for(const item of items){
    if(!out.some(existing => similar(existing.title, item.title))) out.push(item);
  }
  return out;
}

async function fetchGoogleNewsRss(query){
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:2d')}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
  return items.map(m => {
    const block = m[1];
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [,''])[1].replace('<![CDATA[','').replace(']]>','').trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [,'#'])[1].trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [,''])[1].trim();
    const parts = rawTitle.split(' - ');
    const source = parts.length > 1 ? parts.pop() : '';
    const title = parts.join(' - ');
    return { title, source, link, pubDate, rawTitle };
  }).filter(h => h.title);
}

// Builds the "intelligent news engine": dedups near-duplicate wire copy,
// flags high-impact (macro/geopolitical) vs routine headlines, tags
// breaking (< 2h old) vs likely-priced-in (older) stories, scores
// bullish/bearish/neutral, and returns a plain-English "why it matters"
// line for the given asset — per the spec.
export async function getNewsForAsset(env, market, query){
  const key = cacheKey('news', market.id);
  const raw = await cached(env, key, 240, () => fetchGoogleNewsRss(query));
  const deduped = dedupe(raw);

  const now = Date.now();
  const items = deduped.slice(0, 8).map(h => {
    const score = scoreHeadline(h.rawTitle);
    const impact = impactLevel(h.rawTitle);
    const pubMs = h.pubDate ? new Date(h.pubDate).getTime() : NaN;
    const ageMin = isNaN(pubMs) ? null : Math.round((now - pubMs) / 60000);
    const isBreaking = ageMin != null && ageMin < 120;
    const direction = score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
    const confidence = Math.min(95, 40 + Math.abs(score) * 15 + (impact === 'high' ? 15 : 0));
    const why = direction === 'neutral'
      ? `Headline is directionally neutral for ${market.sym} on keyword sentiment — informational only.`
      : `Keyword sentiment reads ${direction} for ${market.sym}${impact==='high' ? ', and touches a high-impact macro/geopolitical theme, so it likely carries above-average weight in price action' : ''}${isBreaking ? '; this is recent enough to still be moving price rather than already priced in' : '; given its age this is more likely already reflected in current price'}.`;
    return { title: h.title, source: h.source, link: h.link, pubDate: h.pubDate, ageMin, isBreaking, impact, direction, score, confidence, why };
  });

  const withScore = items.filter(i => i.score !== 0);
  const avg = withScore.length ? withScore.reduce((a,h)=>a+h.score,0) / withScore.length : 0;
  const sentimentScore = Math.max(0, Math.min(100, 50 + avg*18));
  const label = sentimentScore>=58?'bull':sentimentScore<=42?'bear':'neutral';

  return {
    items,
    rawCount: raw.length,
    dedupedCount: deduped.length,
    sentimentScore,
    label,
    breakingCount: items.filter(i=>i.isBreaking).length,
    highImpactCount: items.filter(i=>i.impact==='high').length,
  };
}
