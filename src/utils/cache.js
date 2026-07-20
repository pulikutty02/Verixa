// Thin cache wrapper: tries KV first (persists across requests/isolates),
// falls back to "no cache" gracefully if KV isn't bound yet so local dev
// and first-deploy-before-KV-is-wired still work.

export async function cached(env, key, ttlSeconds, producer){
  const kv = env.VERIXA_CACHE;
  if(kv){
    try{
      const hit = await kv.get(key, 'json');
      if(hit && hit.__expires > Date.now()) return hit.value;
    }catch(e){ /* ignore cache read errors, fall through to live fetch */ }
  }
  const value = await producer();
  if(kv){
    try{
      await kv.put(key, JSON.stringify({ value, __expires: Date.now() + ttlSeconds*1000 }), { expirationTtl: Math.max(60, ttlSeconds*2) });
    }catch(e){ /* ignore cache write errors */ }
  }
  return value;
}

export function cacheKey(...parts){
  return parts.map(p => String(p)).join(':');
}
