import { findMarket, MARKETS } from '../config/markets.js';
import { TIMEFRAMES, resolveTf } from '../config/timeframes.js';
import { buildFullReport } from '../analysis/report.js';
import { fmtReportMessage, fmtPriceMessage } from './format.js';
import { categoryKeyboard, marketKeyboard, timeframeKeyboard, reAnalyzeKeyboard } from './keyboards.js';
import { getCandles } from '../data/candles.js';

async function tg(env, method, body){
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

async function sendTelegram(env, chatId, text, keyboard){
  return tg(env, 'sendMessage', {
    chat_id: chatId, text, parse_mode:'Markdown', disable_web_page_preview:true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

async function editTelegramMessage(env, chatId, messageId, text, keyboard){
  return tg(env, 'editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode:'Markdown', disable_web_page_preview:true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

async function answerCallbackQuery(env, callbackQueryId, text){
  return tg(env, 'answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

const HELP_TEXT = [
  '*Verixa AI Agent — Commands*',
  '',
  '/analyze — pick a market and timeframe with buttons',
  '/analyze SYMBOL [tf] — direct report (tf: 15m, 1h, 4h, 1d — default 1h)',
  '/price SYMBOL — latest price',
  '/help — this message',
  '',
  'You can also just type naturally, e.g. "what is gold doing?" or "analyze bitcoin".',
  '',
  `Supported: ${MARKETS.map(m=>m.sym).join(', ')}`,
].join('\n');

async function runAnalyze(env, chatId, market, tfKey, editMessageId){
  const tf = TIMEFRAMES[tfKey];
  const busyText = `Analyzing ${market.sym} (${tf.full})…`;
  let placeholder;
  if(editMessageId){
    await editTelegramMessage(env, chatId, editMessageId, busyText);
  } else {
    placeholder = await sendTelegram(env, chatId, busyText);
  }
  try{
    const report = await buildFullReport(env, market, tfKey);
    const text = fmtReportMessage(report);
    const keyboard = reAnalyzeKeyboard(market.id, tfKey);
    const msgId = editMessageId || placeholder?.result?.message_id;
    if(msgId) await editTelegramMessage(env, chatId, msgId, text, keyboard);
    else await sendTelegram(env, chatId, text, keyboard);
  }catch(e){
    const msg = `⚠️ Live data is unavailable for ${market.sym} right now (provider rate-limit or outage). Try again in a moment.`;
    const msgId = editMessageId || placeholder?.result?.message_id;
    if(msgId) await editTelegramMessage(env, chatId, msgId, msg);
    else await sendTelegram(env, chatId, msg);
  }
}

async function runPrice(env, chatId, market){
  try{
    const candles = await getCandles(env, market, '1d');
    const last = candles.at(-1), prev = candles.at(-2) || last;
    const quote = { price:last.c, changePct: ((last.c-prev.c)/prev.c)*100 };
    await sendTelegram(env, chatId, fmtPriceMessage(market, quote));
  }catch(e){
    await sendTelegram(env, chatId, `⚠️ Couldn't fetch a live price for ${market.sym} right now. Try again shortly.`);
  }
}

function parseNaturalLanguage(text){
  const t = text.toLowerCase();
  for(const m of MARKETS){
    const names = [m.id.toLowerCase(), m.sym.toLowerCase(), ...(m.aliases||[])];
    if(names.some(n => t.includes(n))) return m;
  }
  return null;
}

async function handleMessage(env, msg){
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if(text.startsWith('/start')){
    await sendTelegram(env, chatId, `Welcome to *Verixa AI Agent* 👋\n\n${HELP_TEXT}`);
  } else if(text.startsWith('/help')){
    await sendTelegram(env, chatId, HELP_TEXT);
  } else if(text.startsWith('/price')){
    const arg = text.replace('/price','').trim();
    const market = findMarket(arg);
    if(!market) await sendTelegram(env, chatId, arg ? `I don't recognize "${arg}".` : 'Usage: /price XAUUSD', categoryKeyboard());
    else await runPrice(env, chatId, market);
  } else if(text.startsWith('/analyze')){
    const parts = text.replace('/analyze','').trim().split(/\s+/).filter(Boolean);
    if(!parts.length){
      await sendTelegram(env, chatId, 'Pick a category to begin:', categoryKeyboard());
      return;
    }
    const market = findMarket(parts[0]);
    if(!market){
      await sendTelegram(env, chatId, `I don't recognize "${parts[0]}". Pick one instead:`, categoryKeyboard());
      return;
    }
    // Explicit symbol given — if a timeframe arg was also given, honor it
    // exactly (this is the path that used to silently ignore the arg).
    const tfArg = (parts[1] || '').toLowerCase();
    if(TIMEFRAMES[tfArg]){
      await runAnalyze(env, chatId, market, tfArg);
    } else {
      await sendTelegram(env, chatId, `Choose a timeframe for ${market.sym}:`, timeframeKeyboard(market.id));
    }
  } else {
    const nl = parseNaturalLanguage(text);
    if(nl) await sendTelegram(env, chatId, `Choose a timeframe for ${nl.sym}:`, timeframeKeyboard(nl.id));
    else await sendTelegram(env, chatId, `Not sure what you mean. Try /analyze or type "analyze gold".\n\n${HELP_TEXT}`);
  }
}

async function handleCallbackQuery(env, cq){
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const data = cq.data || '';
  await answerCallbackQuery(env, cq.id);

  if(data === 'cats'){
    await editTelegramMessage(env, chatId, messageId, 'Pick a category:', categoryKeyboard());
    return;
  }
  if(data.startsWith('cat:')){
    const cat = data.slice(4);
    await editTelegramMessage(env, chatId, messageId, `Markets in *${cat}*:`, marketKeyboard(cat));
    return;
  }
  if(data.startsWith('mkt:')){
    const marketId = data.slice(4);
    const market = findMarket(marketId);
    if(!market) return;
    await editTelegramMessage(env, chatId, messageId, `Choose a timeframe for ${market.sym}:`, timeframeKeyboard(market.id));
    return;
  }
  if(data.startsWith('tf:')){
    // "tf:<marketId>:<tfKey>" — the exact timeframe the user tapped, threaded
    // straight into buildFullReport. No default ever silently overrides it.
    const [, marketId, tfKeyRaw] = data.split(':');
    const market = findMarket(marketId);
    if(!market) return;
    const tfKey = resolveTf(tfKeyRaw);
    await runAnalyze(env, chatId, market, tfKey, messageId);
    return;
  }
}

export async function handleTelegramUpdate(env, update){
  try{
    if(update.message) await handleMessage(env, update.message);
    else if(update.callback_query) await handleCallbackQuery(env, update.callback_query);
  }catch(e){
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if(chatId) await sendTelegram(env, chatId, '⚠️ Something went wrong handling that. Please try again.');
  }
}
