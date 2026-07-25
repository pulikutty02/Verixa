/* =====================================================================
   VERIXA — HANIRA floating widget
   Small bottom-right launcher present on every page. Opens a compact
   chat panel that talks to the same window.HANIRA engine (hanira-engine.js)
   the full /ai-agent.html page uses, so answers stay consistent site-wide.
   ===================================================================== */
(function () {
  const ROBOT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2.5"/>
      <path d="M12 8V4"/><circle cx="12" cy="3" r="1.1" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/>
      <path d="M9 17.5c1 .7 5 .7 6 0"/>
      <path d="M2 12h2"/><path d="M20 12h2"/>
    </svg>`;
  const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

  const SUGGESTIONS = [
    "Daily bias on Gold",
    "15M read on EURUSD",
    "What is the 4C Model?",
    "Macro backdrop today",
  ];

  function buildMarkup() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="hanira-fab" id="haniraFab" aria-label="Ask HANIRA" aria-expanded="false">
        ${ROBOT_ICON}<span class="fab-dot"></span>
      </button>
      <div class="hanira-widget-panel" id="haniraPanel" role="dialog" aria-label="HANIRA chat">
        <div class="hanira-widget-head">
          <div class="who"><span class="dot"></span>HANIRA<span class="sub">Verixa AI market analyst</span></div>
          <button class="hanira-widget-close" id="haniraClose" aria-label="Close">${CLOSE_ICON}</button>
        </div>
        <div class="hanira-widget-body" id="haniraWidgetBody"></div>
        <div class="hanira-widget-suggest" id="haniraWidgetSuggest"></div>
        <form class="hanira-widget-form" id="haniraWidgetForm">
          <input type="text" id="haniraWidgetInput" placeholder="Ask HANIRA…" autocomplete="off"/>
          <button type="submit" id="haniraWidgetSend">Ask</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);
  }

  function addMessage(body, text, who) {
    const el = document.createElement('div');
    el.className = 'hmsg ' + (who === 'user' ? 'user' : 'bot');
    if (who === 'user') {
      el.textContent = text;
    } else {
      el.innerHTML = `<span class="who">HANIRA</span><div class="bubble">${text}</div>`;
    }
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function addTyping(body) {
    const el = document.createElement('div');
    el.className = 'hmsg bot typing';
    el.innerHTML = `<span class="who">HANIRA</span><div class="bubble"><span></span><span></span><span></span></div>`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function init() {
    buildMarkup();

    const fab = document.getElementById('haniraFab');
    const panel = document.getElementById('haniraPanel');
    const closeBtn = document.getElementById('haniraClose');
    const body = document.getElementById('haniraWidgetBody');
    const suggestWrap = document.getElementById('haniraWidgetSuggest');
    const form = document.getElementById('haniraWidgetForm');
    const input = document.getElementById('haniraWidgetInput');
    const sendBtn = document.getElementById('haniraWidgetSend');

    let opened = false;
    let greeted = false;

    SUGGESTIONS.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => { input.value = q; form.requestSubmit(); });
      suggestWrap.appendChild(b);
    });

    function openPanel() {
      opened = true;
      panel.classList.add('open');
      fab.classList.add('open');
      fab.innerHTML = CLOSE_ICON;
      fab.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        addMessage(body, "Ask me about Gold, FX, Crypto, Indices or the Verixa 4C Model — I read live price action across six timeframes.", 'bot');
      }
      setTimeout(() => input.focus(), 260);
    }
    function closePanel() {
      opened = false;
      panel.classList.remove('open');
      fab.classList.remove('open');
      fab.innerHTML = `${ROBOT_ICON}<span class="fab-dot"></span>`;
      fab.setAttribute('aria-expanded', 'false');
    }
    fab.addEventListener('click', () => (opened ? closePanel() : openPanel()));
    closeBtn.addEventListener('click', closePanel);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(body, text, 'user');
      input.value = '';
      input.disabled = true;
      sendBtn.disabled = true;
      const typingEl = addTyping(body);

      try {
        const reply = window.HANIRA
          ? await window.HANIRA.routeIntent(text, (window.HANIRA.DEFAULT_TF || '4h'))
          : "HANIRA's engine failed to load — check that hanira-engine.js is present alongside this page.";
        typingEl.remove();
        addMessage(body, reply, 'bot');
      } catch (err) {
        typingEl.remove();
        addMessage(body, "I hit a snag reaching live data just now. Try again in a moment, or head to the full Ask HANIRA page.", 'bot');
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
