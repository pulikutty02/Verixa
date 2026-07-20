import { MARKETS, CATS } from '../config/markets.js';
import { TIMEFRAME_ORDER, TIMEFRAMES } from '../config/timeframes.js';

// Callback data is kept short (Telegram caps it at 64 bytes) and fully
// self-describing, so the timeframe the user actually tapped is threaded
// straight through to the backend — this is what fixes the bug where
// every analysis silently defaulted to 1H regardless of selection.
// Format: "mkt:<id>" -> "tf:<marketId>:<tfKey>" -> handled directly.

export function categoryKeyboard(){
  const rows = [];
  for(let i=0;i<CATS.length;i+=3){
    rows.push(CATS.slice(i,i+3).map(c => ({ text:c, callback_data:`cat:${c}` })));
  }
  return { inline_keyboard: rows };
}

export function marketKeyboard(cat){
  const list = MARKETS.filter(m => cat==='All' || m.cat===cat);
  const rows = [];
  for(let i=0;i<list.length;i+=3){
    rows.push(list.slice(i,i+3).map(m => ({ text:m.sym, callback_data:`mkt:${m.id}` })));
  }
  rows.push([{ text:'‹ Back to categories', callback_data:'cats' }]);
  return { inline_keyboard: rows };
}

export function timeframeKeyboard(marketId){
  const row = TIMEFRAME_ORDER.map(tfKey => ({ text: TIMEFRAMES[tfKey].label, callback_data:`tf:${marketId}:${tfKey}` }));
  return { inline_keyboard: [row, [{ text:'‹ Back to markets', callback_data:'cats' }]] };
}

export function reAnalyzeKeyboard(marketId, tfKey){
  return {
    inline_keyboard: [
      [{ text:'🔄 Refresh', callback_data:`tf:${marketId}:${tfKey}` }],
      [{ text:'⏱ Change timeframe', callback_data:`mkt:${marketId}` }],
      [{ text:'📊 Change market', callback_data:'cats' }],
    ],
  };
}
