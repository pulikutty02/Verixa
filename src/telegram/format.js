function fmt(n, dec){ return (n==null||isNaN(n)) ? '—' : n.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec}); }

function esc(s){
  // Minimal Markdown-escape for Telegram's legacy "Markdown" parse mode.
  return String(s).replace(/([_*`\[])/g, '\\$1');
}

export function fmtReportMessage(r){
  const arrow = r.bias==='BULLISH' ? '🟢' : r.bias==='BEARISH' ? '🔴' : '🟡';
  const chg = r.changePct;
  const dec = r.market.dec;
  const lines = [
    `*VERIXA — ${r.market.sym}* (${r.market.desc})`,
    `Timeframe: ${r.tf.full}`,
    ``,
    `${arrow} *${r.bias}*  ·  Confidence ${r.scores.confidence}%`,
    `Price: ${fmt(r.lastClose,dec)}  (${chg>=0?'+':''}${chg.toFixed(2)}%)  ·  Risk: *${r.risk}*`,
    `Institutional bias: ${esc(r.institutionalBias)}`,
    ``,
    `*Scores* — Overall ${r.scores.overall} · Technical ${r.scores.technical} · Macro ${r.scores.macro} · News ${r.scores.news}`,
    ``,
    `*Key levels*`,
    `Support ${fmt(r.levels.support,dec)}  ·  Resistance ${fmt(r.levels.resistance,dec)}`,
    `Invalidation ${fmt(r.levels.invalidation,dec)}  ·  Target ${fmt(r.levels.target,dec)}`,
    ``,
    `*Why:*`,
    ...r.why.slice(0,6).map(w => `▸ ${w}`),
    ``,
    `*Outlook*`,
    `Short: ${r.outlook.shortTerm}`,
    `Medium: ${r.outlook.mediumTerm}`,
    `Long: ${r.outlook.longTerm}`,
    ``,
    `*Trader lens*`,
    `Intraday: ${r.reasoning.intraday}`,
    `Swing: ${r.reasoning.swing}`,
    ``,
    `_${r.disclaimer}_`,
  ];
  // Telegram messages cap at 4096 chars — trim safely if ever exceeded.
  const text = lines.join('\n');
  return text.length > 4000 ? text.slice(0, 3990) + '\n…' : text;
}

export function fmtPriceMessage(market, quote){
  return `*${market.sym}*: ${fmt(quote.price, market.dec)}  (${quote.changePct>=0?'+':''}${quote.changePct.toFixed(2)}%)`;
}
