export function emaSeries(values, period){
  const k = 2/(period+1);
  const out = [];
  values.forEach((v,i) => { out.push(i===0 ? v : v*k + out[i-1]*(1-k)); });
  return out;
}

export function rsiSeries(closes, period=14){
  const out = new Array(Math.min(period, closes.length)).fill(50);
  let avgGain=0, avgLoss=0;
  for(let i=1;i<=period && i<closes.length;i++){
    const diff = closes[i]-closes[i-1];
    avgGain += diff>0?diff:0; avgLoss += diff<0?-diff:0;
  }
  avgGain/=period; avgLoss/=period;
  for(let i=period+1;i<closes.length;i++){
    const diff = closes[i]-closes[i-1];
    const gain = diff>0?diff:0, loss = diff<0?-diff:0;
    avgGain = (avgGain*(period-1)+gain)/period;
    avgLoss = (avgLoss*(period-1)+loss)/period;
    const rs = avgLoss===0 ? 100 : avgGain/avgLoss;
    out.push(100 - (100/(1+rs)));
  }
  return out;
}

export function macd(closes, fast=12, slow=26, signalPeriod=9){
  if(closes.length < slow + signalPeriod) return { macdLine:0, signalLine:0, histogram:0 };
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdLine = emaFast.map((v,i) => v - emaSlow[i]);
  const signalLine = emaSeries(macdLine, signalPeriod);
  const histogram = macdLine.at(-1) - signalLine.at(-1);
  return { macdLine: macdLine.at(-1), signalLine: signalLine.at(-1), histogram };
}

export function atrValue(candles, period=14){
  const trs = [];
  for(let i=1;i<candles.length;i++){
    const c=candles[i], p=candles[i-1];
    trs.push(Math.max(c.h-c.l, Math.abs(c.h-p.c), Math.abs(c.l-p.c)));
  }
  const last = trs.slice(-period);
  return last.length ? last.reduce((a,b)=>a+b,0)/last.length : 0;
}

export function bollingerBandwidth(candles, period=20){
  if(candles.length < period) return 0;
  const slice = candles.slice(-period);
  const mean = slice.reduce((a,c)=>a+c.c,0)/period;
  const variance = slice.reduce((a,c)=>a+Math.pow(c.c-mean,2),0)/period;
  return (Math.sqrt(variance) * 2) / mean * 100;
}

export function detectDivergence(candles, rsiArr){
  const len = Math.min(candles.length, rsiArr.length);
  if(len < 10) return 'none';
  const priceHighs = [], rsiHighs = [];
  for(let i=2;i<len-2;i++){
    if(candles[i].c>candles[i-1].c && candles[i].c>candles[i-2].c && candles[i].c>candles[i+1].c && candles[i].c>candles[i+2].c) priceHighs.push({idx:i, val:candles[i].c});
  }
  for(let i=2;i<len-2;i++){
    if(rsiArr[i]>rsiArr[i-1] && rsiArr[i]>rsiArr[i-2] && rsiArr[i]>rsiArr[i+1] && rsiArr[i]>rsiArr[i+2]) rsiHighs.push({idx:i, val:rsiArr[i]});
  }
  if(priceHighs.length>=2 && rsiHighs.length>=2){
    const ph1=priceHighs.at(-2), ph2=priceHighs.at(-1), rh1=rsiHighs.at(-2), rh2=rsiHighs.at(-1);
    if(ph2.val>ph1.val && rh2.val<rh1.val) return 'bearish';
    if(ph2.val<ph1.val && rh2.val>rh1.val) return 'bullish';
  }
  return 'none';
}

// Market structure: Break of Structure (BOS) / Change of Character (CHoCH).
// Uses swing highs/lows over the lookback window to determine whether the
// most recent break continued the prior trend (BOS) or reversed it (CHoCH).
export function detectStructure(candles, lookback=30){
  const slice = candles.slice(-lookback);
  if(slice.length < 8) return { event:'none', trend:'ranging' };
  const swings = [];
  for(let i=2;i<slice.length-2;i++){
    const c = slice[i];
    const isHigh = c.h>slice[i-1].h && c.h>slice[i-2].h && c.h>slice[i+1].h && c.h>slice[i+2].h;
    const isLow  = c.l<slice[i-1].l && c.l<slice[i-2].l && c.l<slice[i+1].l && c.l<slice[i+2].l;
    if(isHigh) swings.push({ idx:i, type:'high', val:c.h });
    if(isLow)  swings.push({ idx:i, type:'low',  val:c.l });
  }
  swings.sort((a,b)=>a.idx-b.idx);
  const highs = swings.filter(s=>s.type==='high');
  const lows  = swings.filter(s=>s.type==='low');
  if(highs.length<2 || lows.length<2) return { event:'none', trend:'ranging' };
  const higherHighs = highs.at(-1).val > highs.at(-2).val;
  const higherLows  = lows.at(-1).val  > lows.at(-2).val;
  const lowerHighs  = highs.at(-1).val < highs.at(-2).val;
  const lowerLows   = lows.at(-1).val  < lows.at(-2).val;
  const lastClose = slice.at(-1).c;

  let trend = 'ranging';
  if(higherHighs && higherLows) trend = 'uptrend';
  else if(lowerHighs && lowerLows) trend = 'downtrend';

  let event = 'none';
  if(trend==='uptrend' && lastClose > highs.at(-2).val) event = 'BOS_bullish';
  if(trend==='downtrend' && lastClose < lows.at(-2).val) event = 'BOS_bearish';
  if(trend==='uptrend' && lastClose < lows.at(-1).val) event = 'CHoCH_bearish';
  if(trend==='downtrend' && lastClose > highs.at(-1).val) event = 'CHoCH_bullish';

  return { event, trend };
}

// Fair Value Gaps: a 3-candle impralance where candle 1's high/low doesn't
// overlap candle 3's low/high, leaving an unfilled gap price tends to
// revisit. Returns the most recent unmitigated gap, if any.
export function detectFVG(candles, lookback=40){
  const slice = candles.slice(-lookback);
  const gaps = [];
  for(let i=2;i<slice.length;i++){
    const a = slice[i-2], c = slice[i];
    if(c.l > a.h) gaps.push({ type:'bullish', top:c.l, bottom:a.h, idx:i });
    if(c.h < a.l) gaps.push({ type:'bearish', top:a.l, bottom:c.h, idx:i });
  }
  if(!gaps.length) return null;
  const last = gaps.at(-1);
  const lastClose = slice.at(-1).c;
  const mitigated = lastClose <= last.top && lastClose >= last.bottom;
  return { ...last, mitigated };
}

// Simple order-block approximation: last down-close candle before a strong
// up-move (bullish OB) or last up-close candle before a strong down-move
// (bearish OB), using ATR as the "strong move" threshold.
export function detectOrderBlock(candles, atr){
  if(candles.length < 6 || !atr) return null;
  for(let i=candles.length-2;i>=Math.max(1, candles.length-25);i--){
    const move = candles[i+1].c - candles[i].c;
    if(move > atr*1.2 && candles[i].c < candles[i].o){
      return { type:'bullish', top:candles[i].h, bottom:candles[i].l, idx:i };
    }
    if(move < -atr*1.2 && candles[i].c > candles[i].o){
      return { type:'bearish', top:candles[i].h, bottom:candles[i].l, idx:i };
    }
  }
  return null;
}

export function swingLevels(candles, lookback=20){
  const slice = candles.slice(-lookback);
  const swingHigh = Math.max(...slice.map(c=>c.h));
  const swingLow = Math.min(...slice.map(c=>c.l));
  const lastClose = slice.at(-1).c;
  const pivot = (swingHigh+swingLow+lastClose)/3;
  return {
    swingHigh, swingLow, pivot,
    resistance: +(pivot + (swingHigh-swingLow)*0.5).toFixed(6),
    support: +(pivot - (swingHigh-swingLow)*0.5).toFixed(6),
  };
}
