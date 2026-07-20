import { getCandlesForYahooSymbol } from '../data/candles.js';
import { REFERENCE_SYMBOLS } from '../config/markets.js';
import { getFearGreed } from '../data/fearGreed.js';
import { getFredMacro } from '../data/fred.js';

function pctChange(candles){
  const last = candles.at(-1), prev = candles.at(-2) || last;
  return { value: last.c, changePct: prev.c ? ((last.c - prev.c) / prev.c) * 100 : 0 };
}

// Builds the macro overlay shared by every asset report: DXY, VIX, US 10Y
// yield, Fear & Greed, and (if a free FRED key is configured) CPI / Fed
// funds rate / unemployment / GDP / PPI. Cached at the candle layer, so
// this costs at most a handful of extra Yahoo calls per 5-30 minutes
// regardless of how many users/assets request it.
export async function getMacroOverlay(env){
  const [dxy, vix, us10y, fearGreed, fred] = await Promise.all([
    getCandlesForYahooSymbol(env, 'DXY', REFERENCE_SYMBOLS.DXY.ySymbol, '1d').then(pctChange).catch(()=>null),
    getCandlesForYahooSymbol(env, 'VIX', REFERENCE_SYMBOLS.VIX.ySymbol, '1d').then(pctChange).catch(()=>null),
    getCandlesForYahooSymbol(env, 'US10Y', REFERENCE_SYMBOLS.US10Y.ySymbol, '1d').then(pctChange).catch(()=>null),
    getFearGreed(env).catch(()=>null),
    getFredMacro(env).catch(()=>({ available:false, series:{} })),
  ]);

  // Macro score: risk-on (higher) vs risk-off (lower), 0-100.
  // VIX up = risk-off; DXY up = tightening/risk-off for most risk assets;
  // Fear&Greed already 0-100 risk-appetite; yields up = tightening.
  let score = 50;
  if(vix) score -= Math.max(-15, Math.min(15, vix.changePct * 3));
  if(dxy) score -= Math.max(-10, Math.min(10, dxy.changePct * 6));
  if(us10y) score -= Math.max(-8, Math.min(8, us10y.changePct * 2));
  if(fearGreed) score = score*0.6 + fearGreed.value*0.4;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const notes = [];
  if(vix) notes.push(`VIX is ${vix.changePct>=0?'up':'down'} ${Math.abs(vix.changePct).toFixed(2)}% — ${vix.changePct>0.5?'rising fear, risk-off pressure':vix.changePct<-0.5?'fading fear, supportive of risk assets':'stable volatility regime'}.`);
  if(dxy) notes.push(`DXY is ${dxy.changePct>=0?'up':'down'} ${Math.abs(dxy.changePct).toFixed(2)}% — ${dxy.changePct>0.15?'a stronger dollar is typically a headwind for gold, oil and risk assets priced in USD':dxy.changePct<-0.15?'a softer dollar is typically supportive for gold, oil and USD-priced risk assets':'broadly neutral for cross-asset flows'}.`);
  if(us10y) notes.push(`US 10-Year yield is ${us10y.changePct>=0?'up':'down'} ${Math.abs(us10y.changePct).toFixed(2)}% — ${us10y.changePct>0.3?'rising yields raise the opportunity cost of holding gold and can pressure growth stocks':us10y.changePct<-0.3?'falling yields are typically supportive for gold and growth equities':'limited yield-driven pressure either way'}.`);
  if(fearGreed) notes.push(`Crypto Fear & Greed Index reads ${fearGreed.value} (${fearGreed.label}).`);
  if(fred.available){
    if(fred.series.cpi) notes.push(`Latest CPI print: ${fred.series.cpi.value} (as of ${fred.series.cpi.date}).`);
    if(fred.series.fedFundsRate) notes.push(`Effective Fed Funds Rate: ${fred.series.fedFundsRate.value}% (as of ${fred.series.fedFundsRate.date}).`);
    if(fred.series.unemployment) notes.push(`US unemployment rate: ${fred.series.unemployment.value}% (as of ${fred.series.unemployment.date}).`);
  } else {
    notes.push('CPI / Fed Funds Rate / unemployment unavailable — add a free FRED API key to enable (see DEPLOY.md).');
  }

  return { dxy, vix, us10y, fearGreed, fred, score, notes };
}
