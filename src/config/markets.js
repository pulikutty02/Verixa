// Single source of truth for supported assets. Both the Telegram bot and
// the website consume this list through the API — nothing about markets
// is hardcoded anywhere else.

export const MARKETS = [
  { id:'XAUUSD', sym:'XAUUSD', desc:'Spot Gold',      cat:'Metals',  src:'yahoo', ySymbol:'GC=F',       dec:2, aliases:['gold','xau'] },
  { id:'XAGUSD', sym:'XAGUSD', desc:'Spot Silver',     cat:'Metals',  src:'yahoo', ySymbol:'SI=F',       dec:3, aliases:['silver','xag'] },
  { id:'CL',     sym:'WTI',    desc:'Crude Oil',       cat:'Energy',  src:'yahoo', ySymbol:'CL=F',       dec:2, aliases:['oil','wti','crude'] },
  { id:'DXY',    sym:'DXY',    desc:'Dollar Index',    cat:'FX',      src:'yahoo', ySymbol:'DX-Y.NYB',   dec:3, aliases:['dxy','dollar index'] },
  { id:'EURUSD', sym:'EURUSD', desc:'Euro / Dollar',   cat:'FX',      src:'yahoo', ySymbol:'EURUSD=X',   dec:5, aliases:['eurusd','euro'] },
  { id:'GBPUSD', sym:'GBPUSD', desc:'Pound / Dollar',  cat:'FX',      src:'yahoo', ySymbol:'GBPUSD=X',   dec:5, aliases:['gbpusd','cable','pound'] },
  { id:'USDJPY', sym:'USDJPY', desc:'Dollar / Yen',    cat:'FX',      src:'yahoo', ySymbol:'JPY=X',      dec:3, aliases:['usdjpy','yen'] },
  { id:'NQ',     sym:'NAS100', desc:'Nasdaq Futures',  cat:'Indices', src:'yahoo', ySymbol:'NQ=F',       dec:1, aliases:['nasdaq','nas100','nq'] },
  { id:'ES',     sym:'SPX500', desc:'S&P Futures',     cat:'Indices', src:'yahoo', ySymbol:'ES=F',       dec:1, aliases:['spx','sp500','s&p','es'] },
  { id:'YM',     sym:'US30',   desc:'Dow Futures',     cat:'Indices', src:'yahoo', ySymbol:'YM=F',       dec:0, aliases:['dow','us30','ym'] },
  { id:'BTC',    sym:'BTC',    desc:'Bitcoin',         cat:'Crypto',  src:'cg',    gId:'bitcoin',        binSymbol:'BTCUSDT', dec:0, aliases:['btc','bitcoin'] },
  { id:'ETH',    sym:'ETH',    desc:'Ethereum',        cat:'Crypto',  src:'cg',    gId:'ethereum',       binSymbol:'ETHUSDT', dec:1, aliases:['eth','ethereum'] },
  { id:'SOL',    sym:'SOL',    desc:'Solana',          cat:'Crypto',  src:'cg',    gId:'solana',         binSymbol:'SOLUSDT', dec:2, aliases:['sol','solana'] },
  { id:'BNB',    sym:'BNB',    desc:'BNB',             cat:'Crypto',  src:'cg',    gId:'binancecoin',    binSymbol:'BNBUSDT', dec:1, aliases:['bnb'] },
];

// Reference symbols used for macro overlay + cross-asset checks.
// Not user-selectable — fetched internally to give context to every report.
export const REFERENCE_SYMBOLS = {
  DXY:  { ySymbol:'DX-Y.NYB', dec:3 },
  VIX:  { ySymbol:'^VIX',     dec:2 },
  US10Y:{ ySymbol:'^TNX',     dec:3 }, // CBOE 10yr yield index (x10)
  GOLD: { ySymbol:'GC=F',     dec:2 },
  OIL:  { ySymbol:'CL=F',     dec:2 },
  NQ:   { ySymbol:'NQ=F',     dec:1 },
  BTC:  { gId:'bitcoin', binSymbol:'BTCUSDT' },
};

export const NEWS_QUERY = {
  XAUUSD:'gold price XAUUSD', XAGUSD:'silver price XAGUSD', CL:'crude oil price WTI',
  DXY:'US dollar index DXY', EURUSD:'EUR USD forex', GBPUSD:'GBP USD forex', USDJPY:'USD JPY forex',
  NQ:'Nasdaq stock market', ES:'S&P 500 stock market', YM:'Dow Jones stock market',
  BTC:'Bitcoin price', ETH:'Ethereum price', SOL:'Solana price', BNB:'BNB price',
};

export const CATS = ['All','Metals','Energy','FX','Indices','Crypto'];

export function findMarket(query){
  const q = String(query || '').trim().toLowerCase();
  return MARKETS.find(m => m.id.toLowerCase()===q || m.sym.toLowerCase()===q || (m.aliases||[]).includes(q)) || null;
}
