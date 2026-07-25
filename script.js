/* =====================================================================
   VERIXA — Homepage interactions
   No frameworks. Progressive: every section works with JS disabled
   except the live ticker (which just shows static placeholders instead).
   ===================================================================== */

/* ── SINGLE SOURCE OF TRUTH for the Cloudflare Worker URL ──────────
   script.js loads first on every page, so this is the only place you
   need to edit when you (re)deploy the Worker. ai-agent.html and
   hanira-engine.js both read window.VERIXA_API_BASE — change it once
   here and the ticker, HANIRA chat and the AI Agent page all update
   together. Previously these three files each hardcoded their own
   URL (two different hosts), which is why fixing one didn't fix the
   others — that's now fixed by reading from this single variable.
   Point it at your deployed Worker route (custom domain or
   *.workers.dev, no trailing slash). CORS: the Worker must send
   Access-Control-Allow-Origin for this site's origin or requests will
   fail silently in the browser console with a CORS error. */
window.VERIXA_API_BASE = window.VERIXA_API_BASE || 'https://verixa-backend.thepipsociety82.workers.dev';
const API_BASE = window.VERIXA_API_BASE;

/* ── Navbar scroll state ─────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
function onScroll(){
  if(!navbar) return;
  navbar.classList.toggle('scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

/* ── Mobile menu ──────────────────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
if(hamburger && mobileMenu){
  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ── Reveal on scroll ─────────────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');
if('IntersectionObserver' in window && revealEls.length){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

/* ── Animated stat counters ──────────────────────────────────────── */
function animateCount(el){
  const target = el.textContent.trim();
  const numMatch = target.match(/[\d.]+/);
  if(!numMatch) return;
  const num = parseFloat(numMatch[0]);
  const suffix = target.replace(numMatch[0], '');
  const duration = 900;
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (num * eased).toFixed(numMatch[0].includes('.') ? 1 : 0) + suffix;
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const statNums = document.querySelectorAll('.stat-cell .num');
if('IntersectionObserver' in window && statNums.length){
  const statIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateCount(entry.target);
        statIo.unobserve(entry.target);
      }
    });
  }, { threshold:0.5 });
  statNums.forEach(el => statIo.observe(el));
}

/* ── Live ticker rail ─────────────────────────────────────────────
   Pulls last price + % change for a small watchlist from the existing
   Verixa backend (/api/price?market=SYMBOL). Falls back to the static
   markup already in the HTML if the request fails or is blocked by
   CORS/network — the rail simply stays as-is, never shows an error. */
const TICKER_SYMBOLS = ['XAUUSD', 'BTC', 'EURUSD', 'ETH', 'DXY', 'ES'];

async function fetchTickerPrice(symbol){
  const res = await fetch(`${API_BASE}/api/price?market=${encodeURIComponent(symbol)}`, {
    headers: { 'Accept': 'application/json' },
  });
  if(!res.ok) throw new Error(`price fetch failed for ${symbol}`);
  return res.json();
}

function renderTicker(rows){
  const track = document.getElementById('tickerTrack');
  if(!track || !rows.length) return;
  const build = () => rows.map(r => {
    const up = r.changePct >= 0;
    const arrow = up ? '▲' : '▼';
    const cls = up ? 'up' : 'down';
    const price = Number(r.price).toLocaleString(undefined, { maximumFractionDigits: 5 });
    const pct = Math.abs(r.changePct).toFixed(2);
    return `<span class="ticker-item"><span class="sym">${r.market}</span> <span class="data">${price}</span> <span class="data ${cls}">${arrow} ${pct}%</span></span>`;
  }).join('');
  // duplicate the row set once so the CSS marquee loops seamlessly
  track.innerHTML = build() + build();
}

(async function loadTicker(){
  try{
    const results = await Promise.allSettled(TICKER_SYMBOLS.map(fetchTickerPrice));
    const rows = results
      .filter(r => r.status === 'fulfilled' && r.value && typeof r.value.price === 'number')
      .map(r => r.value);
    if(rows.length) renderTicker(rows);
  }catch(e){
    /* silent — static placeholders already in the markup remain visible */
  }
})();

/* ── Contact form (contact.html only — no-ops elsewhere) ───────────
   Simulated submit: no backend endpoint exists yet for form delivery.
   Wire a real Worker route + fetch() here when one exists. */
(function initContactForm(){
  const form = document.getElementById('contact-form');
  if(!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const required = form.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
      if(!field.value.trim()){
        field.style.borderColor = '#9a5a52';
        valid = false;
        field.addEventListener('input', () => { field.style.borderColor = ''; }, { once:true });
      }
    });
    if(!valid) return;
    if(btn){ btn.textContent = 'Sending…'; btn.disabled = true; btn.style.opacity = '0.7'; }
    setTimeout(() => {
      form.style.display = 'none';
      const msg = document.getElementById('success-msg');
      if(msg) msg.classList.add('show');
    }, 1100);
  });
})();
