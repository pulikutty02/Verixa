import { getCandles } from '../data/candles.js';
import { TIMEFRAMES } from '../config/timeframes.js';
import { NEWS_QUERY } from '../config/markets.js';
import { analyzeTimeframe, multiTimeframeAlignment } from './technical.js';
import { getMacroOverlay } from './macro.js';
import { getNewsForAsset } from './news.js';
import { buildCrossAssetChecks, CROSS_ASSET_NOTES } from './crossAsset.js';

function fmt(n, dec){ return (n==null||isNaN(n)) ? '—' : n.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec}); }

function outlookFor(bias, mtf, confidence){
  const short = bias==='NEUTRAL' ? 'Range-bound; wait for a decisive break before committing.' : `${bias==='BULLISH'?'Upside':'Downside'} bias favored intraday while structure holds, confidence ${confidence}%.`;
  const medium = mtf.alignment.includes('bullish') ? 'Medium-term timeframes (1H-4H) lean constructive; pullbacks are more likely to be bought than sold heavily.' :
    mtf.alignment.includes('bearish') ? 'Medium-term timeframes (1H-4H) lean weak; rallies are more likely to be sold than chased.' :
    'Medium-term timeframes are mixed — no strong multi-day edge either direction yet.';
  const long = mtf.table['1d'] === 'bull' ? 'Daily structure remains constructive; the broader trend is still up.' :
    mtf.table['1d'] === 'bear' ? 'Daily structure remains weak; the broader trend is still down.' :
    'Daily structure is neutral to mixed — no dominant long-term trend currently.';
  return { shortTerm: short, mediumTerm: medium, longTerm: long };
}

function reasoningByTrader(bias, levels, atrPct, risk, confidence){
  const dir = bias==='BULLISH' ? 'long' : bias==='BEARISH' ? 'short' : 'no directional';
  const intraday = bias==='NEUTRAL'
    ? `An intraday trader would likely stand aside or fade extremes between ${fmt(levels.support,levels.dec)} and ${fmt(levels.resistance,levels.dec)} rather than force a direction.`
    : `An intraday trader might look for a ${dir} entry on a pullback toward ${fmt(levels.pivot,levels.dec)}, with a tight stop given ${risk.toLowerCase()} volatility (ATR ${atrPct.toFixed(2)}% of price).`;
  const swing = bias==='NEUTRAL'
    ? 'A swing trader would likely wait for a confirmed break of the recent range before sizing a multi-day position.'
    : `A swing trader could use the current ${bias.toLowerCase()} bias as a multi-day thesis, adding on confirmation and using ${fmt(levels.invalidation,levels.dec)} as the level that invalidates the setup.`;
  const longTerm = bias==='NEUTRAL'
    ? 'A long-term investor has no strong signal here to act on either way from this report alone.'
    : `A long-term investor would treat this as one data point supporting a ${bias.toLowerCase()} tilt, weighted alongside the medium/long-term trend read rather than on its own — confidence in this single-timeframe read is ${confidence}%.`;
  return { intraday, swing, longTerm };
}

// The single function that produces the complete report shape consumed by
// both the Telegram bot (formatted to text) and the website (rendered to
// the report screen). This is the "single source of truth" for analysis —
// there is no separate copy of this math anywhere else in the project.
export async function buildFullReport(env, market, tfKey){
  const tf = TIMEFRAMES[tfKey];
  const candles = await getCandles(env, market, tfKey);
  const a = analyzeTimeframe(candles, tfKey);

  const [mtf, macro, news] = await Promise.all([
    multiTimeframeAlignment(env, market, tfKey, a),
    getMacroOverlay(env).catch(() => ({ score:50, notes:[], dxy:null, vix:null, us10y:null, fearGreed:null, fred:{available:false,series:{}} })),
    getNewsForAsset(env, market, NEWS_QUERY[market.id] || market.desc).catch(() => ({ items:[], sentimentScore:50, label:'neutral', rawCount:0, dedupedCount:0, breakingCount:0, highImpactCount:0 })),
  ]);

  const levels = { ...a.levels, invalidation: null, target: null, dec: market.dec };
  const assetChangePct = ((a.lastClose - a.prevClose) / a.prevClose) * 100;
  const crossAsset = buildCrossAssetChecks(market.id, assetChangePct, macro);

  const technicalScore = Math.round(
    a.scores.structureScore*0.5 + a.scores.momentumScore*0.3 + a.scores.priceActionScore*0.2
  );
  const macroScore = macro.score;
  const newsScore = Math.round(news.sentimentScore);
  const sentimentScore = macro.fearGreed
    ? Math.round(newsScore*0.6 + macro.fearGreed.value*0.4)
    : newsScore;

  const overall = Math.round(technicalScore*0.5 + macroScore*0.25 + newsScore*0.25);
  let bias = 'NEUTRAL';
  if(overall>=58) bias='BULLISH'; else if(overall<=42) bias='BEARISH';

  const confidence = Math.max(35, Math.min(96, Math.round(45 + Math.abs(overall-50)*1.1 + (mtf.agreeCount>=3?6:0))));

  levels.invalidation = bias==='BULLISH' ? levels.support - a.atr*0.5 : levels.resistance + a.atr*0.5;
  levels.target = bias==='BULLISH' ? levels.resistance + (levels.resistance-levels.pivot) : levels.support - (levels.pivot-levels.support);

  const institutionalBias = bias==='NEUTRAL' ? 'NO EDGE / RANGE-BOUND'
    : `${bias} — ${mtf.alignment}`;

  const why = [];
  why.push(`EMA9 is ${a.ema.e9>a.ema.e21?'above':'below'} EMA21 on the ${a.tfLabel} chart — ${a.trend.includes('bull')?'constructive':a.trend.includes('bear')?'weak':'mixed'} short-term structure.`);
  if(a.structure.event !== 'none') why.push(`${a.structure.event.replace('_',' ')} detected — market structure ${a.structure.event.includes('bullish')?'favors buyers':'favors sellers'} right now.`);
  why.push(`RSI(14) reads ${a.rsi.toFixed(1)} — ${a.rsi>=70?'stretched, watch exhaustion':a.rsi<=30?'oversold, watch for a bounce':a.rsi>=55?'momentum leans bullish':a.rsi<=45?'momentum leans bearish':'momentum is balanced'}.`);
  why.push(`MACD histogram is ${a.macd.histogram>=0?'positive':'negative'} — ${a.macd.histogram>=0?'bullish':'bearish'} momentum confirmation.`);
  if(a.divergence!=='none') why.push(`${a.divergence.toUpperCase()} RSI divergence detected — potential reversal signal.`);
  if(a.fvg && !a.fvg.mitigated) why.push(`An unmitigated ${a.fvg.type} Fair Value Gap sits between ${fmt(a.fvg.bottom,market.dec)} and ${fmt(a.fvg.top,market.dec)} — price often revisits these zones.`);
  if(a.orderBlock) why.push(`A ${a.orderBlock.type} order block is in play between ${fmt(a.orderBlock.bottom,market.dec)} and ${fmt(a.orderBlock.top,market.dec)}.`);
  why.push(`Multi-timeframe read is ${mtf.alignment} (${mtf.agreeCount}/${mtf.total} timeframes agree).`);
  why.push(`Macro backdrop scores ${macroScore}/100 (risk-on/off gauge from DXY, VIX, yields${macro.fearGreed?', Fear & Greed':''}).`);
  if(news.items.length) why.push(`News sentiment is ${news.label} across ${news.dedupedCount} deduplicated headlines (${news.breakingCount} breaking, ${news.highImpactCount} high-impact).`);
  else why.push('No fresh headlines retrieved for this scan — news carries no weight in this report.');
  why.push(`Volatility (ATR) is ${a.atrPct.toFixed(2)}% of price — ${a.risk.toLowerCase()} risk regime for position sizing.`);

  const outlook = outlookFor(bias, mtf, confidence);
  const reasoning = reasoningByTrader(bias, levels, a.atrPct, a.risk, confidence);

  return {
    market: { id:market.id, sym:market.sym, desc:market.desc, dec:market.dec, cat:market.cat },
    tf: { id: tfKey, label: tf.label, full: tf.full },
    timestamp: Date.now(),
    lastClose: a.lastClose, prevClose: a.prevClose, changePct: +assetChangePct.toFixed(2),
    scores: { overall, technical: technicalScore, macro: macroScore, news: newsScore, sentiment: sentimentScore, confidence },
    bias, institutionalBias, risk: a.risk,
    outlook,
    levels,
    mtf,
    macro,
    news,
    crossAsset,
    crossAssetNote: CROSS_ASSET_NOTES[market.id] || null,
    edge: { divergence: a.divergence, bbw: a.bbw, structureEvent: a.structure.event, fvg: a.fvg, orderBlock: a.orderBlock },
    why,
    reasoning,
    disclaimer: 'This explains current conditions and contributing factors — it is not a trading signal or investment advice. Trade decisions and risk remain yours.',
  };
}
