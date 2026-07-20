export const TIMEFRAMES = {
  '5m': { id:'5m',  label:'5M',  full:'5 Minute',  yahoo:{interval:'5m',  range:'5d'},  cg:{days:1,  agg:1}, binance:'5m',  cacheTtl:90 },
  '15m':{ id:'15m', label:'15M', full:'15 Minute', yahoo:{interval:'15m', range:'5d'},  cg:{days:1,  agg:1}, binance:'15m', cacheTtl:180 },
  '1h': { id:'1h',  label:'1H',  full:'1 Hour',    yahoo:{interval:'60m', range:'1mo'}, cg:{days:1,  agg:2}, binance:'1h',  cacheTtl:300 },
  '4h': { id:'4h',  label:'4H',  full:'4 Hour',    yahoo:{interval:'60m', range:'3mo', agg:4}, cg:{days:30, agg:1}, binance:'4h', cacheTtl:600 },
  '1d': { id:'1d',  label:'1D',  full:'Daily',     yahoo:{interval:'1d',  range:'1y'},  cg:{days:365,agg:1}, binance:'1d',  cacheTtl:1800 },
};

export const TIMEFRAME_ORDER = ['5m','15m','1h','4h','1d'];
export const DEFAULT_TF = '1h';

// The set of timeframes fetched together to build the multi-timeframe
// trend-alignment read (requested: "multi-timeframe trend alignment").
export const MTF_STACK = ['15m','1h','4h','1d'];

export function resolveTf(key){
  return TIMEFRAMES[key] ? key : DEFAULT_TF;
}
