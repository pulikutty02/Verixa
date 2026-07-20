import { fetchJson } from '../utils/http.js';
import { cached } from '../utils/cache.js';

// FRED requires a free API key (instant signup, no approval wait):
// https://fred.stlouisfed.org/docs/api/api_key.html
// Set it with: wrangler secret put FRED_API_KEY
// If absent, macro data simply omits these series rather than failing —
// this is the "minimum mandatory configuration" carve-out for a source
// that legally requires per-user credentials.

const SERIES = {
  cpi:            'CPIAUCSL',   // CPI, all urban consumers
  fedFundsRate:   'FEDFUNDS',   // Effective federal funds rate
  us10y:          'DGS10',      // 10-Year Treasury yield
  unemployment:   'UNRATE',     // Unemployment rate
  gdp:            'GDP',        // Nominal GDP
  ppi:            'PPIACO',     // Producer Price Index
};

async function fetchSeries(apiKey, seriesId){
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
  const json = await fetchJson(url);
  const obs = (json.observations || []).filter(o => o.value !== '.');
  if(!obs.length) return null;
  const latest = obs[0];
  const prev = obs[1];
  const value = Number(latest.value);
  const prevValue = prev ? Number(prev.value) : null;
  return {
    value,
    date: latest.date,
    changeFromPrev: prevValue != null ? +(value - prevValue).toFixed(3) : null,
  };
}

export async function getFredMacro(env){
  const apiKey = env.FRED_API_KEY;
  if(!apiKey) return { available: false, series: {} };
  return cached(env, 'macro:fred', 3600, async () => {
    const entries = await Promise.all(
      Object.entries(SERIES).map(async ([key, seriesId]) => {
        try{ return [key, await fetchSeries(apiKey, seriesId)]; }
        catch(e){ return [key, null]; }
      })
    );
    const series = Object.fromEntries(entries.filter(([, v]) => v));
    return { available: true, series };
  });
}
