export async function fetchJson(url, opts = {}){
  const { timeoutMs = 7000, headers = {} } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent':'Mozilla/5.0 (VerixaBot)', ...headers } });
    if(!res.ok) throw new Error(`bad status ${res.status} for ${url}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export async function fetchText(url, opts = {}){
  const { timeoutMs = 7000, headers = {} } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent':'Mozilla/5.0 (VerixaBot)', ...headers } });
    if(!res.ok) throw new Error(`bad status ${res.status} for ${url}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

// Runs producers in order, returns the first that resolves without throwing.
export async function firstSuccess(producers){
  let lastErr;
  for(const p of producers){
    try{ return await p(); }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('all providers failed');
}
