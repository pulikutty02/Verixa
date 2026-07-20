import { getCandles } from '../data/candles.js';
import { MTF_STACK, TIMEFRAMES } from '../config/timeframes.js';
import {
  emaSeries, rsiSeries, macd, atrValue, bollingerBandwidth, detectDivergence,
  detectStructure, detectFVG, detectOrderBlock, swingLevels,
} from './indicators.js';

function trendLabelFromEma(e9, e21, e50){
  if(e9>e21 && e21>e50) return 'bull';
  if(e9<e21 && e21<e50) return 'bear';
  if(e9>e21) return 'bull-lean';
  if(e9<e21) return 'bear-lean';
  return 'neutral';
}

// One-timeframe read: EMA structure, RSI, MACD, ATR, BB width, divergence,
// BOS/CHoCH, FVG, order block, S/R. This is what "requested_tf" analysis
// runs on; the MTF stack below runs a lighter version of this per timeframe
// purely to build the trend-alignment table.
export function analyzeTimeframe(candles, tfKey){
  const tf = TIMEFRAMES[tfKey];
  const closes = candles.map(c=>c.c);
  const ema9 = emaSeries(closes,9), ema21 = emaSeries(closes,21), ema50 = emaSeries(closes, Math.min(50,closes.length));
  const rsiArr = rsiSeries(closes,14);
  const lastClose = closes.at(-1);
  const lastEma9 = ema9.at(-1), lastEma21 = ema21.at(-1), lastEma50 = ema50.at(-1);
  const lastRsi = rsiArr.at(-1);
  const atrVal = atrValue(candles,14);
  const bbw = bollingerBandwidth(candles,20);
  const divergence = detectDivergence(candles, rsiArr);
  const macdResult = macd(closes);
  const structure = detectStructure(candles);
  const fvg = detectFVG(candles);
  const orderBlock = detectOrderBlock(candles, atrVal);
  const levels = swingLevels(candles, 20);

  let structureScore = 50;
  if(lastEma9>lastEma21 && lastEma21>lastEma50) structureScore=82;
  else if(lastEma9<lastEma21 && lastEma21<lastEma50) structureScore=18;
  else if(lastEma9>lastEma21) structureScore=62;
  else if(lastEma9<lastEma21) structureScore=38;
  if(structure.event==='BOS_bullish') structureScore = Math.min(95, structureScore+8);
  if(structure.event==='BOS_bearish') structureScore = Math.max(5, structureScore-8);
  if(structure.event==='CHoCH_bullish') structureScore = Math.min(90, structureScore+5);
  if(structure.event==='CHoCH_bearish') structureScore = Math.max(10, structureScore-5);

  const momentumScore = Math.max(0, Math.min(100, lastRsi));
  const backIdx = Math.max(0, closes.length-10);
  const pctMove = ((lastClose-closes[backIdx])/closes[backIdx])*100;
  const priceActionScore = Math.max(0, Math.min(100, 50+pctMove*10));
  const volPct = (atrVal/lastClose)*100;
  let risk = 'MEDIUM';
  if(volPct<0.25) risk='LOW'; else if(volPct>0.9) risk='HIGH';
  const volatilityRiskScore = Math.max(6, Math.min(94, Math.round(volPct*55)));

  return {
    tfKey, tfLabel: tf.full,
    lastClose, prevClose: closes.at(-2) ?? lastClose,
    trend: trendLabelFromEma(lastEma9, lastEma21, lastEma50),
    ema:{ e9:lastEma9, e21:lastEma21, e50:lastEma50 },
    rsi: lastRsi,
    macd: macdResult,
    atr: atrVal, atrPct: volPct, bbw,
    divergence, structure, fvg, orderBlock, levels,
    pctMove,
    scores:{ structureScore, momentumScore, priceActionScore, volatilityRiskScore },
    risk,
  };
}

// Fetches candles for every timeframe in MTF_STACK and reduces them to a
// simple per-timeframe bull/bear/neutral trend read plus an overall
// alignment score (how many timeframes agree with the requested timeframe).
export async function multiTimeframeAlignment(env, market, requestedTfKey, requestedAnalysis){
  const others = MTF_STACK.filter(k => k !== requestedTfKey);
  const results = await Promise.all(others.map(async tfKey => {
    try{
      const candles = await getCandles(env, market, tfKey);
      const a = analyzeTimeframe(candles, tfKey);
      return [tfKey, a.trend];
    }catch(e){
      return [tfKey, 'unavailable'];
    }
  }));
  const table = Object.fromEntries(results);
  table[requestedTfKey] = requestedAnalysis.trend;

  const bullish = Object.values(table).filter(t => t==='bull' || t==='bull-lean').length;
  const bearish = Object.values(table).filter(t => t==='bear' || t==='bear-lean').length;
  const total = MTF_STACK.length;
  let alignment = 'mixed';
  if(bullish >= total-1) alignment = 'strongly aligned bullish';
  else if(bearish >= total-1) alignment = 'strongly aligned bearish';
  else if(bullish > bearish) alignment = 'leaning bullish';
  else if(bearish > bullish) alignment = 'leaning bearish';

  return { table, alignment, agreeCount: Math.max(bullish, bearish), total };
}
