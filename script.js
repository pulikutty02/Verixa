/* =============================================
   VERIXA — Global Script
   Mobile-first. iOS & Android optimised.
   ============================================= */

/* ─── UTILITIES ──────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isMobile = () => window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── PAGE FADE-IN ───────────────────────────── */
// Set opacity before DOM is ready to prevent flash
document.documentElement.style.opacity = '0';
document.documentElement.style.transition = 'opacity 0.3s ease';

/* ─── DOM READY ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Fade page in
  requestAnimationFrame(() => {
    document.documentElement.style.opacity = '1';
  });

  initNavbar();
  initScrollReveal();
  initStatCounters();
  initHeroCanvas();
  initContactForm();
  initPageTransitions();
  setActiveNavLink();
});

/* ─── NAVBAR ─────────────────────────────────── */
function initNavbar() {
  const navbar    = $('#navbar');
  const hamburger = $('#hamburger');
  const mobileMenu = $('#mobile-menu');
  if (!navbar) return;

  // Scroll: add .scrolled class
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load

  // Hamburger toggle
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
    // Prevent body scroll when menu is open (iOS fix)
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu on nav link click
  $$('#mobile-menu a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  // Close menu on outside tap (mobile)
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });

  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}

/* ─── ACTIVE NAV LINK ────────────────────────── */
function setActiveNavLink() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a, #mobile-menu a').forEach(link => {
    const href = link.getAttribute('href');
    const isActive =
      href === page ||
      (page === '' && href === 'index.html') ||
      (page === 'index.html' && href === 'index.html');
    link.classList.toggle('active', isActive);
  });
}

/* ─── SCROLL REVEAL ──────────────────────────── */
function initScrollReveal() {
  if (prefersReducedMotion) {
    // Skip animation — just show everything
    $$('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger delay capped at 3 items to avoid long waits on mobile
        const delay = Math.min(i, 3) * 70;
        setTimeout(() => entry.target.classList.add('visible'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -30px 0px'
  });

  $$('.reveal').forEach(el => observer.observe(el));
}

/* ─── STAT COUNTERS ──────────────────────────── */
function initStatCounters() {
  if (prefersReducedMotion) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, 1600, suffix);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  $$('[data-target]').forEach(el => observer.observe(el));
}

function animateCounter(el, target, duration, suffix) {
  const start = performance.now();
  const isFloat = target % 1 !== 0;
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = (isFloat
      ? (eased * target).toFixed(1)
      : Math.floor(eased * target)) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ─── HERO CANVAS ────────────────────────────── */
function initHeroCanvas() {
  const canvas = $('#hero-canvas');
  if (!canvas) return;

  // Skip canvas on very low-end or reduced-motion
  if (prefersReducedMotion) return;

  const ctx = canvas.getContext('2d');
  let animId;
  let frame = 0;

  // Particle count: fewer on mobile for performance
  const NUM_PARTICLES = isMobile() ? 35 : 70;

  let particles = [];
  let candles = [];

  function buildParticles() {
    particles = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * (isMobile() ? 0.25 : 0.4),
        vy: (Math.random() - 0.5) * (isMobile() ? 0.25 : 0.4),
        r: Math.random() * 1.6 + 0.4,
        alpha: Math.random() * 0.45 + 0.12,
      });
    }
  }

  function buildCandles() {
    candles = [];
    const count = isMobile() ? 10 : 18;
    const step = 0.9 / count;
    for (let i = 0; i < count; i++) {
      const open = 0.3 + Math.random() * 0.4;
      const close = open + (Math.random() - 0.45) * 0.15;
      candles.push({
        x: 0.05 + i * step,
        open, close,
        high: Math.max(open, close) + Math.random() * 0.06,
        low:  Math.min(open, close) - Math.random() * 0.06,
      });
    }
  }

  // Debounced resize
  let resizeTimer;
  function resize() {
    canvas.width  = canvas.offsetWidth  || canvas.clientWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || canvas.clientHeight || window.innerHeight;
    buildParticles();
    buildCandles();
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  window.addEventListener('resize', handleResize, { passive: true });
  resize();

  // Connection distance: shorter on mobile
  const CONNECT_DIST = isMobile() ? 70 : 110;

  function draw() {
    animId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    // Grid lines
    ctx.strokeStyle = 'rgba(59,130,246,0.055)';
    ctx.lineWidth = 1;
    const gSize = isMobile() ? 36 : 42;
    for (let x = 0; x < canvas.width; x += gSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,208,132,${p.alpha})`;
      ctx.fill();

      // Connections — skip on mobile for perf
      if (!isMobile()) {
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,208,132,${0.07 * (1 - dist / CONNECT_DIST)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    // Candlesticks
    const w = canvas.width, h = canvas.height;
    const cw = Math.max(3, w * 0.012);
    const offset = Math.sin(frame * 0.008) * 4;
    candles.forEach((c, idx) => {
      const cx = w * c.x;
      const baseY = h * 0.58 + offset + Math.sin(frame * 0.006 + idx) * 3;
      const scaledH = h * 0.22;
      const oy = baseY - c.open  * scaledH;
      const cy = baseY - c.close * scaledH;
      const hy = baseY - c.high  * scaledH;
      const ly = baseY - c.low   * scaledH;
      const bull = c.close >= c.open;
      const colFill   = bull ? 'rgba(0,208,132,0.32)' : 'rgba(239,68,68,0.28)';
      const colStroke = bull ? 'rgba(0,208,132,0.5)'  : 'rgba(239,68,68,0.42)';

      ctx.strokeStyle = colFill; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(cx, ly); ctx.stroke();

      ctx.fillStyle = colFill;
      ctx.fillRect(cx - cw / 2, Math.min(oy, cy), cw, Math.abs(cy - oy) || 1);
      ctx.strokeStyle = colStroke; ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - cw / 2, Math.min(oy, cy), cw, Math.abs(cy - oy) || 1);
    });
  }

  draw();

  // Pause animation when tab is hidden (saves battery on mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      frame = 0;
      draw();
    }
  });
}

/* ─── CONTACT FORM ───────────────────────────── */
function initContactForm() {
  const form = $('#contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    if (!btn) return;

    // Basic validation
    const required = $$('[required]', form);
    let valid = true;
    required.forEach(field => {
      if (!field.value.trim()) {
        field.style.borderColor = '#ef4444';
        field.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
        valid = false;
        // Reset on input
        field.addEventListener('input', () => {
          field.style.borderColor = '';
          field.style.boxShadow = '';
        }, { once: true });
      }
    });
    if (!valid) return;

    // Simulate send
    btn.textContent = 'Sending…';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    setTimeout(() => {
      form.style.display = 'none';
      const msg = $('#success-msg');
      if (msg) msg.classList.add('show');
    }, 1400);
  });

  // Float labels / input styling on focus (iOS fix — prevents zoom on focus)
  $$('.form-input, .form-select, .form-textarea', form).forEach(el => {
    // iOS zooms in if font-size < 16px — ensure it's at least 16px on mobile
    if (isMobile()) el.style.fontSize = '16px';
  });
}

/* ─── PAGE TRANSITIONS ───────────────────────── */
function initPageTransitions() {
  // Only wire up internal .html links
  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isInternal = !href.startsWith('http') &&
                       !href.startsWith('#') &&
                       !href.startsWith('mailto') &&
                       !href.startsWith('tel') &&
                       !href.startsWith('javascript') &&
                       href.endsWith('.html');
    if (!isInternal) return;

    link.addEventListener('click', (e) => {
      // Don't intercept if modifier keys held
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      document.documentElement.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 280);
    });
  });
}

