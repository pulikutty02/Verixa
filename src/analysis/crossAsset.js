// Cross-asset "confirming / diverging" checks. These are directional
// relationship checks against the recent % move of the reference asset —
// not a statistical (Pearson) correlation coefficient, and the report
// labels them that way so nobody mistakes this for more rigor than it is.

function rel(name, assetChangePct, refChangePct, expectedSign, refLabel){
  if(assetChangePct == null || refChangePct == null) return null;
  const assetDir = assetChangePct >= 0 ? 1 : -1;
  const refDir = refChangePct >= 0 ? 1 : -1;
  const confirming = (assetDir * expectedSign) === refDir || (assetChangePct===0 || refChangePct===0);
  return {
    pair: name,
    refLabel,
    refChangePct: +refChangePct.toFixed(2),
    assetChangePct: +assetChangePct.toFixed(2),
    relation: expectedSign === -1 ? 'typically inverse' : 'typically positive',
    status: confirming ? 'confirming' : 'diverging',
  };
}

export function buildCrossAssetChecks(marketId, assetChangePct, macro){
  const checks = [];
  if(macro.dxy) checks.push(rel('vs DXY', assetChangePct, macro.dxy.changePct, marketId==='XAUUSD'||marketId==='XAGUSD'||marketId==='CL' ? -1 : -1, 'US Dollar Index'));
  if(macro.us10y) checks.push(rel('vs US 10Y Yield', assetChangePct, macro.us10y.changePct, marketId==='XAUUSD'||marketId==='XAGUSD' ? -1 : 1, '10-Year Treasury Yield'));
  if(macro.vix) checks.push(rel('vs VIX', assetChangePct, macro.vix.changePct, marketId==='BTC'||marketId==='ETH'||marketId==='NQ'||marketId==='ES' ? -1 : (marketId==='XAUUSD' ? 1 : -1), 'CBOE Volatility Index'));
  return checks.filter(Boolean);
}

export const CROSS_ASSET_NOTES = {
  XAUUSD: 'Gold typically moves inverse to the US Dollar and real yields, and positive with risk-off fear (VIX) as a safe-haven flow.',
  XAGUSD: 'Silver tracks gold\'s macro drivers but with higher beta, plus industrial-demand sensitivity to risk-on/off cycles.',
  CL: 'Crude oil is sensitive to the dollar (inverse), global growth expectations, and OPEC+ supply decisions.',
  DXY: 'The Dollar Index moves inverse to most USD-priced commodities and, often, to risk assets during dollar-strength regimes.',
  BTC: 'Bitcoin has recently traded with a positive correlation to the Nasdaq as a high-beta risk asset, and inverse to the VIX.',
  ETH: 'Ethereum follows Bitcoin\'s macro regime with typically higher volatility.',
  NQ: 'Nasdaq futures are sensitive to real yields (inverse) and risk appetite (inverse to VIX).',
  ES: 'S&P futures track broad risk appetite, with sensitivity to yields and the dollar.',
};
