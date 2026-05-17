(function () {
  'use strict';

  /* ─── Version & Config ─── */
  var WIDGET_VERSION = '1.1.0';
  var CONFIG = window.__KOKOBOT_CONFIG || {};
  var API_URL = CONFIG.apiUrl || 'https://your-kokobot.vercel.app';
  var PRIMARY_COLOR = CONFIG.primaryColor || '#3B82F6';
  var FETCH_TIMEOUT_MS = 10000;

  /* ─── API URL Validation ─── */
  if (API_URL.indexOf('your-kokobot') !== -1 || API_URL.indexOf('your-chatbot') !== -1) {
    console.error('[kokobot] ERROR: API_URL not configured! Update the apiUrl in embed.js or set window.__KOKOBOT_CONFIG.apiUrl');
  }
  console.log('[kokobot] v' + WIDGET_VERSION + ' initialized');

  /* ─── Error Logging ─── */
  var ERROR_LOG = [];
  var MAX_ERROR_LOG = 50;
  function logError(context, error) {
    var entry = { t: Date.now(), c: context, e: error && error.message ? error.message : String(error) };
    ERROR_LOG.push(entry);
    if (ERROR_LOG.length > MAX_ERROR_LOG) ERROR_LOG.shift();
    console.warn('[kokobot]', context, error);
  }

  /* ─── Secure Session ID ─── */
  function generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      var hex = '';
      for (var i = 0; i < arr.length; i++) {
        hex += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
      }
      return 'embed-' + hex;
    }
    return 'embed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  var SESSION_ID = generateSessionId();

  /* ─── Timer Management ─── */
  var activeTimers = [];
  function safeSetTimeout(fn, ms) {
    var id = setTimeout(function () {
      var idx = activeTimers.indexOf(id);
      if (idx > -1) activeTimers.splice(idx, 1);
      fn();
    }, ms);
    activeTimers.push(id);
    return id;
  }
  function safeClearTimeout(id) {
    clearTimeout(id);
    var idx = activeTimers.indexOf(id);
    if (idx > -1) activeTimers.splice(idx, 1);
  }
  function cleanupAllTimers() {
    for (var i = 0; i < activeTimers.length; i++) clearTimeout(activeTimers[i]);
    activeTimers = [];
  }

  /* ─── City Data ─── */
  var CITIES = {
    WA: ['Seattle', 'Bellevue', 'Redmond', 'Tacoma', 'Spokane', 'Everett', 'Renton', 'Kent', 'Federal Way', 'Kirkland', 'Other city'],
    OR: ['Portland', 'Eugene', 'Salem', 'Beaverton', 'Hillsboro', 'Gresham', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Other city'],
    CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Fresno', 'Oakland', 'Long Beach', 'Bakersfield', 'Anaheim', 'Other city'],
  };
  var STATE_NAMES = { WA: 'Washington', OR: 'Oregon', CA: 'California' };

  /* ─── FAQ Data for Topic Browsing ─── */
  var FAQ_DATA = {
    gates: [
      { q: 'What types of gates do you install?', a: 'We install sliding gates, swing gates, cantilever gates, bi-fold gates, vertical lift gates, custom security gates, and decorative entrance gates.' },
      { q: 'How much does an automatic gate cost?', a: 'Pricing depends on gate size, materials, automation system, access controls, and custom fabrication requirements. Most projects vary significantly based on design and property conditions. We recommend scheduling a free consultation for accurate pricing.' },
      { q: 'How long does installation take?', a: 'Most residential projects take between several days to a few weeks depending on permitting, fabrication, electrical work, and customization.' },
      { q: 'Can I control my gate from my phone?', a: 'Yes — many modern systems allow smartphone access, remote opening, cloud-based control, and live monitoring.' },
      { q: 'Do gates improve property value?', a: 'Yes — automated gates often improve curb appeal, security, privacy, and overall property value.' },
    ],
    repairs: [
      { q: 'Do you offer emergency gate repair?', a: 'Yes — we provide emergency troubleshooting and repair services for many gate systems.' },
      { q: 'My gate stopped opening. What should I do?', a: 'The issue may involve power supply, sensors, motors, remotes, safety loops, or access control systems. Our technicians can diagnose the issue quickly.' },
      { q: 'Do you repair all brands?', a: 'We work with many major gate operator and access control brands depending on system compatibility.' },
      { q: 'How quickly can someone come out?', a: 'Availability depends on location and workload, but we always prioritize emergency security issues.' },
      { q: 'Can you repair damaged gate tracks?', a: 'Yes — we repair tracks, rollers, hinges, welding damage, motors, and structural issues.' },
    ],
    fencing: [
      { q: 'What fence types do you install?', a: 'We install iron, steel, aluminum, wood, chain link, privacy, decorative, and commercial security fencing.' },
      { q: 'Which fence is best for security?', a: 'Steel and iron fencing are among the most durable and secure options for commercial and residential security.' },
      { q: 'Can you build custom fences?', a: 'Yes — we offer fully custom fencing designs and fabrication options.' },
      { q: 'Do you handle HOA projects?', a: 'Yes — we regularly work with HOA communities and property management companies.' },
      { q: 'How long does fence installation take?', a: 'Timeline depends on material, terrain, project size, permitting, and weather conditions.' },
    ],
    accessControl: [
      { q: 'What access control systems do you install?', a: 'We install keypad systems, RFID systems, card readers, cloud-based access systems, telephone entry systems, smartphone access systems, and commercial access control integrations.' },
      { q: 'Can residents open gates from their phones?', a: 'Yes — many systems allow app-based control and remote access.' },
      { q: 'Can you integrate cameras with the gate system?', a: 'Absolutely. We can integrate cameras, intercoms, and security monitoring systems.' },
      { q: 'Can deliveries access the property?', a: 'Yes — modern systems can provide temporary access codes, scheduled access, or remote approval.' },
    ],
    commercial: [
      { q: 'Do you work on commercial security projects?', a: 'Yes — we handle warehouses, industrial facilities, commercial properties, apartment complexes, and secured business facilities.' },
      { q: 'Can you handle large-scale projects?', a: 'Yes — our team supports large custom fabrication and commercial security projects.' },
      { q: 'Do you work with general contractors?', a: 'Absolutely. We frequently coordinate with general contractors, developers, and property managers.' },
    ],
    sales: [
      { q: 'Do you offer free estimates?', a: 'Yes — we offer free consultations and estimates for most gate, fencing, and security projects.' },
      { q: 'How much does an automatic gate cost?', a: 'Costs depend on gate type, materials, automation, access control, and site preparation. We provide free estimates tailored to your needs.' },
      { q: 'What payment options do you offer?', a: 'We work with various payment arrangements and can discuss financing options during your consultation.' },
    ],
    general: [
      { q: 'What services do you offer?', a: 'Interactive Gates & Security specializes in automated gates, custom gates, fence installation, access control systems, security integrations, gate repairs, commercial security systems, and custom fabrication.' },
      { q: 'What areas do you service?', a: 'We currently provide services throughout Washington, Oregon, and California for both residential and commercial clients.' },
      { q: 'Are you licensed and insured?', a: 'Yes — our team operates professionally with proper licensing and insurance requirements depending on the project location and scope.' },
      { q: 'Do you work on residential and commercial projects?', a: 'Absolutely. We handle residential homes, HOAs, apartment complexes, warehouses, commercial buildings, industrial properties, and private estates.' },
    ],
  };

  var TOPIC_OPTIONS = ['Gates', 'Repairs', 'Fencing', 'Access Control', 'Commercial', 'Pricing', 'General'];
  var TOPIC_CATEGORIES = { Gates: 'gates', Repairs: 'repairs', Fencing: 'fencing', 'Access Control': 'accessControl', Commercial: 'commercial', Pricing: 'sales', General: 'general' };

  var QA_RESPONSES = {
    'pricing & estimates': "Great question! Our pricing depends on the type of gate, materials, and size of your project. We offer free estimates so you know exactly what to expect. A typical residential gate installation ranges from $3,000 to $15,000 depending on complexity.",
    'installation process': "Our installation process is straightforward! We start with a free consultation and estimate, then schedule the installation at your convenience. Most residential installations are completed in 1-3 days. Our team handles everything from permits to final inspection.",
    'materials & options': "We work with a variety of materials including steel, aluminum, wrought iron, and wood. Each has its own benefits — steel is the most durable, aluminum is great for coastal areas, and wrought iron offers classic elegance.",
    'timeline': "Timelines vary based on the project scope. Simple repairs can be done within a week, while new installations typically take 2-6 weeks from consultation to completion. Custom designs may take a bit longer.",
    'warranty': "We stand behind our work! All installations come with a comprehensive warranty covering materials and workmanship. Gate openers and access control systems include manufacturer warranties as well.",
  };

  /* ─── Page Detection ─── */
  var PAGE_ROUTES = {
    '/': 'homepage', '/home': 'homepage',
    '/gate-installation': 'gateInstallation', '/sliding-gates': 'gateInstallation',
    '/swing-gates': 'gateInstallation', '/custom-gates': 'gateInstallation',
    '/gates': 'gateInstallation',
    '/gate-repair': 'repair', '/emergency-repair': 'repair', '/repair': 'repair',
    '/fencing': 'fence', '/fence': 'fence',
    '/commercial': 'commercial', '/commercial-gates': 'commercial',
    '/about': 'about', '/about-us': 'about',
    '/blog': 'blog',
  };

  var PAGE_CONFIG = {
    homepage:     { desktopMs: 6000,  mobileMs: 10000, scrollPct: 0.45 },
    gateInstallation: { desktopMs: 4000,  mobileMs: 7000 },
    repair:       { desktopMs: 3000,  mobileMs: 5000 },
    fence:        { desktopMs: 6000,  mobileMs: 10000, scrollPct: 0.45 },
    commercial:   { desktopMs: 4000,  mobileMs: 7000 },
    about:        { desktopMs: 8000,  mobileMs: 12000 },
    blog:         { desktopMs: 10000, mobileMs: 15000 },
    'default':    { desktopMs: 7000,  mobileMs: 11000, scrollPct: 0.45 },
  };

  function getPageCategory(path) {
    var exact = PAGE_ROUTES[path];
    if (exact) return exact;
    if (path.indexOf('/blog/') === 0) return 'blog';
    return 'default';
  }

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /* ─── Visitor Tracking ─── */
  var VISITOR_KEY = 'kokobot_visitor';
  var COOLDOWN_KEY = 'kokobot_trigger_cooldown';
  var COOLDOWN_MS = 300000;

  function getVisitorStatus() {
    try {
      var stored = localStorage.getItem(VISITOR_KEY);
      var now = Date.now();
      var visitCount = 0;
      var lastVisit = 0;
      if (stored) {
        var data = JSON.parse(stored);
        visitCount = data.visitCount || 0;
        lastVisit = data.lastVisit || 0;
      }
      localStorage.setItem(VISITOR_KEY, JSON.stringify({ lastVisit: now, visitCount: visitCount + 1 }));
      return { isNew: visitCount === 0, visitCount: visitCount, lastVisit: lastVisit };
    } catch (e) {
      logError('visitor-tracking', e);
      return { isNew: true, visitCount: 0, lastVisit: 0 };
    }
  }

  function isInCooldown() {
    try {
      var val = localStorage.getItem(COOLDOWN_KEY);
      if (!val) return false;
      return Date.now() < parseInt(val, 10);
    } catch (e) { return false; }
  }

  function setCooldown() {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS)); } catch (e) {}
  }

  /* ─── Multi-tab Sync ─── */
  try {
    window.addEventListener('storage', function (e) {
      if (e.key === COOLDOWN_KEY) {
        // sync cooldown across tabs
      }
    });
  } catch (e) {}

  /* ─── Lead Form State ─── */
  var leadFormStep = 1;
  var leadFormData = { name: '', phone: '', email: '', city: '', serviceType: '', budgetRange: '', timeline: '', bestContactTime: '' };
  var leadFormErrors = {};

  var SERVICE_TYPES = ['New Gate Installation', 'Gate Repair', 'Fence Installation', 'Access Control System', 'Security System', 'Commercial Project', 'Custom Fabrication', 'Other'];
  var BUDGET_RANGES = ['Under $2,000', '$2,000 \u2013 $5,000', '$5,000 \u2013 $10,000', '$10,000 \u2013 $25,000', '$25,000+', 'Not Sure'];
  var TIMELINES = ['ASAP / Emergency', 'Within 1 Week', 'Within 1 Month', 'Within 3 Months', 'Just Researching'];
  var CONTACT_TIMES = ['Anytime', 'Morning (8am\u201312pm)', 'Afternoon (12pm\u20135pm)', 'Evening (5pm\u20138pm)'];

  function validateLeadField(field, value) {
    var trimmed = (value || '').trim();
    switch (field) {
      case 'name': return trimmed.length < 2 ? 'Name must be at least 2 characters' : '';
      case 'phone': return /^\+?1?\d{10,15}$/.test(trimmed.replace(/[\s\-\(\)]/g, '')) ? '' : 'Enter a valid phone number';
      case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? '' : 'Enter a valid email address';
      case 'city': return trimmed.length < 2 ? 'Enter a city or address' : '';
      case 'serviceType': case 'budgetRange': case 'timeline': case 'bestContactTime': return trimmed ? '' : 'Please select an option';
      default: return '';
    }
  }

  function validateLeadStep(step) {
    var fields = ['name', 'phone', 'email'];
    var errs = {};
    fields.forEach(function (f) { var e = validateLeadField(f, leadFormData[f]); if (e) errs[f] = e; });
    leadFormErrors = errs;
    return Object.keys(errs).length === 0;
  }

  /* ─── HTML Escaping (XSS Protection) ─── */
  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ─── Styles ─── */
  var CHAT_STYLES = [
    'html { scroll-behavior: smooth; }',
    '#kokobot-chat-root { position: fixed; bottom: 0; right: 0; z-index: 99999; }',
    '.kokobot-chat-widget, .kokobot-bubble, .kokobot-panel, .kokobot-backdrop { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
    '.kokobot-bubble { position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; border-radius: 50%; background: ' + PRIMARY_COLOR + '; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10000; transition: background 0.2s, transform 0.2s; }',
    '.kokobot-bubble:hover { background: #2563EB; transform: scale(1.05); }',
    '.kokobot-bubble.is-open { background: #3B82F6; }',
    '.kokobot-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; background: #EF4444; border-radius: 10px; color: white; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; }',
    '.kokobot-panel { position: fixed; bottom: 96px; right: 24px; width: 380px; height: 520px; background: #FFFFFF; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; z-index: 10000; }',
    '.kokobot-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9999; }',
    '.kokobot-header { height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #E2E8F0; background: #FFFFFF; flex-shrink: 0; }',
    '.kokobot-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; }',
    '.kokobot-message-user { background: #1D4ED8; color: #FFFFFF; border-radius: 12px 12px 4px 12px; padding: 10px 14px; max-width: 80%; align-self: flex-end; }',
    '.kokobot-message-bot { background: #F1F5F9; color: #1E293B; border-radius: 12px 12px 12px 4px; padding: 10px 14px; max-width: 85%; align-self: flex-start; }',
    '.kokobot-typing-dots { display: flex; gap: 4px; padding: 10px 14px; align-self: flex-start; }',
    '.kokobot-typing-dot { width: 8px; height: 8px; border-radius: 50%; background: #CBD5E1; animation: kokobot-bounce 0.6s ease-in-out infinite; }',
    '.kokobot-typing-dot:nth-child(2) { animation-delay: 0.1s; }',
    '.kokobot-typing-dot:nth-child(3) { animation-delay: 0.2s; }',
    '@keyframes kokobot-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }',
    '@keyframes kokobot-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }',
    '@keyframes kokobot-fade-in { from { opacity: 0; } to { opacity: 1; } }',
    '.kokobot-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 12px; background: #FFFFFF; flex-shrink: 0; }',
    '.kokobot-quick-reply { background: #FFFFFF; border: 1px solid #CBD5E1; color: #1E293B; padding: 8px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: background 0.15s; white-space: nowrap; }',
    '.kokobot-quick-reply:hover { background: #F1F5F9; }',
    '.kokobot-input-wrapper { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #E2E8F0; background: #FFFFFF; flex-shrink: 0; }',
    '.kokobot-input { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 10px 16px; color: #1E293B; font-size: 14px; outline: none; }',
    '.kokobot-input:focus { border-color: ' + PRIMARY_COLOR + '; }',
    '.kokobot-send-btn { width: 40px; height: 40px; border-radius: 50%; background: ' + PRIMARY_COLOR + '; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
    '.kokobot-send-btn:hover { background: #2563EB; }',
    '.kokobot-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
    '@media (max-width: 640px) { .kokobot-panel { bottom: 80px; right: 12px; left: 12px; width: auto; height: 480px; border-radius: 16px; } .kokobot-bubble { bottom: 16px; right: 16px; } }',
    '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
    '.kokobot-lead-form { border-top: 1px solid #E2E8F0; background: #FFFFFF; padding: 16px; display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0; }',
    '.kokobot-lead-form h3 { margin: 0 0 4px; color: #1E293B; font-size: 15px; font-weight: 600; }',
    '.kokobot-lead-form .subtitle { color: #64748B; font-size: 13px; margin-bottom: 16px; }',
    '.kokobot-lf-step-indicator { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }',
    '.kokobot-lf-dot { width: 10px; height: 10px; border-radius: 50%; background: #E2E8F0; transition: background 0.2s; flex-shrink: 0; }',
    '.kokobot-lf-dot.active { background: ' + PRIMARY_COLOR + '; }',
    '.kokobot-lf-line { flex: 1; height: 2px; background: #E2E8F0; }',
    '.kokobot-lf-line.active { background: ' + PRIMARY_COLOR + '; }',
    '.kokobot-lf-step-label { color: #64748B; font-size: 12px; margin-bottom: 12px; }',
    '.kokobot-lf-fields { flex: 1; overflow-y: auto; margin-bottom: 16px; }',
    '.kokobot-lf-field { margin-bottom: 12px; }',
    '.kokobot-lf-field label { display: block; font-size: 12px; color: #64748B; margin-bottom: 4px; }',
    '.kokobot-lf-field input, .kokobot-lf-field select { width: 100%; padding: 10px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; color: #1E293B; font-size: 14px; outline: none; box-sizing: border-box; }',
    '.kokobot-lf-field input:focus, .kokobot-lf-field select:focus { border-color: ' + PRIMARY_COLOR + '; }',
    '.kokobot-lf-field .error { font-size: 11px; color: #EF4444; margin-top: 2px; }',
    '.kokobot-lf-field select { appearance: auto; }',
    '.kokobot-lf-buttons { display: flex; gap: 8px; flex-shrink: 0; }',
    '.kokobot-lf-btn-primary { flex: 1; background: ' + PRIMARY_COLOR + '; border: none; border-radius: 8px; padding: 10px 16px; color: #FFFFFF; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; }',
    '.kokobot-lf-btn-primary:hover { background: #2563EB; }',
    '.kokobot-lf-btn-primary:disabled { background: #CBD5E1; cursor: not-allowed; }',
    '.kokobot-lf-btn-secondary { flex: 1; background: transparent; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 16px; color: #64748B; font-size: 14px; cursor: pointer; }',
    '.kokobot-lf-error { margin-top: 8px; padding: 8px 12px; background: rgba(239,68,68,0.1); border: 1px solid #EF4444; border-radius: 8px; color: #EF4444; font-size: 13px; flex-shrink: 0; }',
    '.kokobot-lf-error button { margin-top: 8px; background: ' + PRIMARY_COLOR + '; color: #FFFFFF; border: none; border-radius: 6px; padding: 6px 14px; font-size: 12px; cursor: pointer; }',
    '.kokobot-lf-error button:hover { background: #2563EB; }',
    '.kokobot-success-view { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px; text-align: center; flex: 1; }',
    '.kokobot-success-view h3 { color: #1E293B; font-size: 18px; font-weight: 600; margin: 0; }',
    '.kokobot-success-view p { color: #64748B; font-size: 14px; margin: 0; }',
    '.kokobot-success-view button { margin-top: 12px; background: ' + PRIMARY_COLOR + '; color: #FFFFFF; border: none; border-radius: 8px; padding: 10px 24px; font-size: 14px; font-weight: 500; cursor: pointer; }',
  ].join('\n');

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = CHAT_STYLES;
    style.id = 'kokobot-styles';
    style.setAttribute('data-version', WIDGET_VERSION);
    document.head.appendChild(style);
  }

  function injectHTML() {
    var div = document.createElement('div');
    div.id = 'kokobot-chat-root';
    document.body.appendChild(div);
    return div;
  }

  function renderBubble(root) {
    root.innerHTML =
      '<button id="kokobot-bubble-btn" class="kokobot-bubble" aria-label="Open chat" aria-expanded="false">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '</button>' +
      '<div id="kokobot-panel" class="kokobot-panel" style="display:none" role="dialog" aria-modal="true" aria-label="Interactive Gates Chat">' +
        '<div class="kokobot-header">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#1D4ED8);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#FFFFFF;font-weight:700;font-size:13px">IG</span></div>' +
            '<div><div style="color:#1E293B;font-size:14px;font-weight:600">Interactive Gates</div><div style="display:flex;align-items:center;gap:4px;color:#64748B;font-size:11px"><span style="width:7px;height:7px;border-radius:50%;background:#22C55E;display:inline-block"></span>Online</div></div>' +
          '</div>' +
          '<button id="kokobot-close-btn" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:18px;padding:4px" aria-label="Close chat">&#10005;</button>' +
        '</div>' +
        '<div id="kokobot-messages" class="kokobot-messages" aria-live="polite" aria-label="Chat messages">' +
          '<div id="kokobot-messages-end"></div>' +
        '</div>' +
        '<div id="kokobot-lead-form-container"></div>' +
        '<div id="kokobot-input-area" class="kokobot-input-wrapper">' +
          '<input id="kokobot-input" class="kokobot-input" type="text" placeholder="Type a message..." aria-label="Type your message" />' +
          '<button id="kokobot-send-btn" class="kokobot-send-btn" aria-label="Send">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  /* ─── Chat Logic ─── */
  function initChat(root) {
    var bubble = document.getElementById('kokobot-bubble-btn');
    var panel = document.getElementById('kokobot-panel');
    var closeBtn = document.getElementById('kokobot-close-btn');
    var messages = document.getElementById('kokobot-messages');
    var input = document.getElementById('kokobot-input');
    var sendBtn = document.getElementById('kokobot-send-btn');
    var leadFormContainer = document.getElementById('kokobot-lead-form-container');

    var isOpen = false;
    var userOpened = false;
    var stage = 'stateSelect';
    var collectedFields = {};
    var turnCount = 0;
    var qaCount = 0;
    var selectedTopic = '';
    var leadSubmitted = false;
    var lastSubmitPayload = null;

    function toggle() {
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'flex' : 'none';
      bubble.classList.toggle('is-open', isOpen);
      bubble.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        userOpened = true;
        setCooldown();
        if (messages.children.length <= 1 && !leadSubmitted) {
          sendWelcome();
        }
        safeSetTimeout(function () { if (input) input.focus(); }, 100);
      } else {
        cleanupAllTimers();
      }
    }

    /* ─── Auto-open ─── */
    var autoTriggered = false;

    function doAutoOpen() {
      if (autoTriggered) return;
      if (isOpen) return;
      if (isInCooldown()) return;
      autoTriggered = true;
      setCooldown();
      userOpened = false;
      var badge = document.createElement('span');
      badge.className = 'kokobot-badge';
      badge.textContent = '1';
      bubble.appendChild(badge);
      bubble.style.animation = 'none';
      bubble.offsetHeight;
      bubble.style.animation = '';
    }

    var currentPath = window.location.pathname;
    var category = getPageCategory(currentPath);
    var cfg = PAGE_CONFIG[category] || PAGE_CONFIG['default'];
    var delay = isMobile() ? cfg.mobileMs : cfg.desktopMs;
    var timerId = safeSetTimeout(function () {
      var visitor = getVisitorStatus();
      if (visitor.visitCount <= 1) {
        doAutoOpen();
        safeSetTimeout(function () {
          if (autoTriggered && !isOpen && !userOpened) {
            toggle();
          }
        }, 100);
      }
    }, delay);

    var scrollPct = cfg.scrollPct || 0;
    var scrollTicking = false;
    function onScroll() {
      if (autoTriggered) return;
      if (!scrollPct) return;
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(function () {
        scrollTicking = false;
        var scrollY = window.scrollY;
        var winHeight = window.innerHeight;
        var docHeight = document.documentElement.scrollHeight;
        var ratio = scrollY / (docHeight - winHeight);
        if (ratio >= scrollPct) {
          doAutoOpen();
          toggle();
          window.removeEventListener('scroll', onScroll);
        }
      });
    }
    if (scrollPct > 0) {
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    function onMouseLeave(e) {
      if (autoTriggered) return;
      if (e.clientY > 50) return;
      doAutoOpen();
      toggle();
      document.removeEventListener('mouseleave', onMouseLeave);
    }
    document.addEventListener('mouseleave', onMouseLeave);

    /* ─── Escape Key ─── */
    function onKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        toggle();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    /* ─── Message Functions ─── */
    function addMessage(text, sender) {
      var el = document.createElement('div');
      el.className = 'kokobot-message-' + sender;
      el.textContent = text;
      messages.insertBefore(el, document.getElementById('kokobot-messages-end'));
      messages.scrollTop = messages.scrollHeight;
    }

    function addTyping() {
      var el = document.createElement('div');
      el.className = 'kokobot-typing-dots';
      el.id = 'kokobot-typing';
      el.innerHTML = '<div class="kokobot-typing-dot"></div><div class="kokobot-typing-dot"></div><div class="kokobot-typing-dot"></div>';
      messages.insertBefore(el, document.getElementById('kokobot-messages-end'));
      messages.scrollTop = messages.scrollHeight;
    }

    function removeTyping() {
      var el = document.getElementById('kokobot-typing');
      if (el) el.remove();
    }

    function removeQuickReplies() {
      var qr = document.getElementById('kokobot-quick-replies');
      if (qr) qr.remove();
    }

    function addQuickReply(labels) {
      removeQuickReplies();
      var container = document.createElement('div');
      container.id = 'kokobot-quick-replies';
      container.className = 'kokobot-quick-replies';
      labels.forEach(function (label) {
        var btn = document.createElement('button');
        btn.className = 'kokobot-quick-reply';
        btn.textContent = label;
        btn.addEventListener('click', function () { handleSend(label); });
        container.appendChild(btn);
      });
      messages.insertBefore(container, document.getElementById('kokobot-messages-end'));
      messages.scrollTop = messages.scrollHeight;
    }

    function showInputArea(show) {
      var area = document.getElementById('kokobot-input-area');
      if (area) area.style.display = show ? 'flex' : 'none';
    }

    function hideMessages() {
      messages.style.display = 'none';
    }

    function showMessages() {
      messages.style.display = 'flex';
    }

    /* ─── Welcome ─── */
    function sendWelcome() {
      addMessage("Hi there! I'm here to help you with gates, fencing, and security solutions from Interactive Gates & Security. To get started, which state are you located in?", 'bot');
      addQuickReply(['Washington', 'Oregon', 'California']);
      stage = 'stateSelect';
      showInputArea(false);
    }

    /* ─── State Machine Handlers ─── */
    var STATE_HANDLERS = {
      stateSelect: function (lowerText, text) {
        if (lowerText === 'washington' || lowerText === 'oregon' || lowerText === 'california') {
          var stateKey = lowerText === 'washington' ? 'WA' : lowerText === 'oregon' ? 'OR' : 'CA';
          collectedFields.state = stateKey;
          return {
            text: 'Great, ' + STATE_NAMES[stateKey] + '! We cover that area. Which city are you in?',
            replies: CITIES[stateKey] || [],
            nextStage: 'citySelect',
            showInput: false
          };
        }
        return {
          text: "Thank you so much for your interest! Unfortunately, we don't currently serve your area. We're working on expanding our coverage, so please check back in the future. Wishing you all the best!",
          replies: [],
          nextStage: 'conversion',
          showInput: true
        };
      },

      citySelect: function (lowerText, text) {
        if (lowerText === 'other city') {
          return {
            text: "No problem! Just type the name of your city and I'll check if we cover your area.",
            replies: [],
            nextStage: 'cityInput',
            showInput: true
          };
        }
        collectedFields.city = text;
        return {
          text: "Perfect! Now I'd love to know \u2014 what type of service are you interested in? I can help with any of the following:",
          replies: ['Automated Gates', 'Gate Repair', 'Fencing', 'Access Control', 'Commercial Projects'],
          nextStage: 'serviceSelect',
          showInput: false
        };
      },

      cityInput: function (lowerText, text) {
        collectedFields.city = text.trim();
        return {
          text: "Perfect! Now I'd love to know \u2014 what type of service are you interested in? I can help with any of the following:",
          replies: ['Automated Gates', 'Gate Repair', 'Fencing', 'Access Control', 'Commercial Projects'],
          nextStage: 'serviceSelect',
          showInput: false
        };
      },

      serviceSelect: function (lowerText, text) {
        collectedFields.serviceType = text;
        return {
          text: 'Great choice! I can help with ' + text + '. What would you like to know more about?',
          replies: ['Pricing & Estimates', 'Installation Process', 'Materials & Options', 'Timeline', 'Warranty'],
          nextStage: 'qa',
          showInput: false
        };
      },

      qa: function (lowerText, text) {
        if (lowerText === 'leave my details') {
          return {
            text: "Wonderful! Please fill out the form below and we'll get back to you as soon as possible.",
            replies: [],
            nextStage: 'conversion',
            showInput: false,
            showForm: true
          };
        }
        if (lowerText === 'browse questions & answers' || lowerText === 'browse questions') {
          return {
            text: 'Sure! Pick a topic below and I\'ll answer your questions about it:',
            replies: TOPIC_OPTIONS.concat(['Leave My Details']),
            nextStage: 'topicSelect',
            showInput: false
          };
        }
        qaCount++;
        var remaining = 3 - qaCount;
        var matched = QA_RESPONSES[lowerText];
        var botText = '';
        if (matched) {
          botText = matched;
        } else {
          botText = 'That\'s a great question! Our team has extensive experience with ' + text + ' and would be happy to provide detailed information. ';
          if (remaining > 0) {
            botText += 'Feel free to ask me anything else \u2014 you have ' + remaining + ' more question' + (remaining > 1 ? 's' : '') + ' before we wrap up!';
          }
        }
        if (remaining > 0) {
          return {
            text: botText,
            replies: ['Ask Another Question', 'Leave My Details', 'Browse Questions & Answers'],
            nextStage: 'qa',
            showInput: false
          };
        }
        botText += '\n\nBased on our conversation, I think it would be great to connect you with one of our specialists. You can leave your details and we\'ll reach out, or browse more questions by topic. What works best for you?';
        return {
          text: botText,
          replies: ['Leave My Details', 'Browse Questions & Answers'],
          nextStage: 'conversion',
          showInput: false
        };
      },

      conversion: function (lowerText, text) {
        if (lowerText === 'leave my details') {
          return {
            text: "Wonderful! Please fill out the form below and we'll get back to you as soon as possible.",
            replies: [],
            nextStage: 'conversion',
            showInput: false,
            showForm: true
          };
        }
        return {
          text: 'Sure! Pick a topic below and I\'ll answer your questions about it:',
          replies: TOPIC_OPTIONS.concat(['Leave My Details']),
          nextStage: 'topicSelect',
          showInput: false
        };
      },

      topicSelect: function (lowerText, text) {
        if (lowerText === 'leave my details') {
          return {
            text: "Wonderful! Please fill out the form below and we'll get back to you as soon as possible.",
            replies: [],
            nextStage: 'conversion',
            showInput: false,
            showForm: true
          };
        }
        var matchedTopic = TOPIC_OPTIONS.filter(function (t) { return t.toLowerCase() === lowerText; })[0];
        if (matchedTopic) {
          selectedTopic = matchedTopic;
          var cat = TOPIC_CATEGORIES[matchedTopic];
          var faqs = FAQ_DATA[cat] || FAQ_DATA.general;
          var remainingFAQs = faqs.slice(1).map(function (f) { return f.q; });
          return {
            text: faqs[0].a,
            replies: remainingFAQs.concat(['Change Topic', 'Leave My Details']),
            nextStage: 'topicQA',
            showInput: false
          };
        }
        return {
          text: 'Please pick one of the topics below:',
          replies: TOPIC_OPTIONS.concat(['Leave My Details']),
          nextStage: 'topicSelect',
          showInput: false
        };
      },

      topicQA: function (lowerText, text) {
        if (lowerText === 'leave my details') {
          return {
            text: "Wonderful! Please fill out the form below and we'll get back to you as soon as possible.",
            replies: [],
            nextStage: 'conversion',
            showInput: false,
            showForm: true
          };
        }
        if (lowerText === 'change topic') {
          return {
            text: 'Sure! Pick a topic below:',
            replies: TOPIC_OPTIONS.concat(['Leave My Details']),
            nextStage: 'topicSelect',
            showInput: false
          };
        }
        var cat = TOPIC_CATEGORIES[selectedTopic] || 'general';
        var topicFAQs = FAQ_DATA[cat] || FAQ_DATA.general;
        var matchedFAQ = null;
        var matchedIdx = -1;
        for (var i = 0; i < topicFAQs.length; i++) {
          if (topicFAQs[i].q.toLowerCase() === lowerText) {
            matchedFAQ = topicFAQs[i];
            matchedIdx = i;
            break;
          }
        }
        if (matchedFAQ) {
          var remaining = topicFAQs.slice(matchedIdx + 1).map(function (f) { return f.q; });
          return {
            text: matchedFAQ.a,
            replies: remaining.concat(['Change Topic', 'Leave My Details']),
            nextStage: 'topicQA',
            showInput: false
          };
        }
        return {
          text: 'That\'s a great question about ' + selectedTopic + '! Our specialists can give you a detailed answer. Would you like to leave your details?',
          replies: ['Change Topic', 'Leave My Details'],
          nextStage: 'topicQA',
          showInput: false
        };
      }
    };

    /* ─── Process Message ─── */
    function processUserMessage(text) {
      var lowerText = text.toLowerCase().trim();
      turnCount++;

      if (lowerText === 'start over' || lowerText === 'restart') {
        stage = 'stateSelect';
        collectedFields = {};
        qaCount = 0;
        selectedTopic = '';
        leadSubmitted = false;
        removeQuickReplies();
        removeTyping();
        hideLeadForm();
        showMessages();
        showInputArea(false);
        sendWelcome();
        return;
      }

      var handler = STATE_HANDLERS[stage];
      if (!handler) {
        logError('state-machine', 'Unknown stage: ' + stage);
        return;
      }

      var delay = 400 + Math.random() * 400;
      safeSetTimeout(function () {
        var result = handler(lowerText, text);
        stage = result.nextStage || stage;

        removeTyping();
        addMessage(result.text, 'bot');

        if (result.replies && result.replies.length > 0) {
          addQuickReply(result.replies);
        } else {
          removeQuickReplies();
        }

        showInputArea(result.showInput || false);

        if (result.showForm) {
          safeSetTimeout(function () { renderLeadForm(); }, 300);
        }
      }, delay);
    }

    /* ─── Lead Form ─── */
    function hideLeadForm() {
      leadFormContainer.innerHTML = '';
      leadFormContainer.style.display = 'none';
      showMessages();
      showInputArea(false);
    }

    function renderLeadForm() {
      leadFormStep = 1;
      leadFormData = { name: '', phone: '', email: '', city: '', serviceType: '', budgetRange: '', timeline: '', bestContactTime: '' };
      leadFormErrors = {};
      hideMessages();
      showInputArea(false);
      leadFormContainer.style.display = 'flex';
      leadFormContainer.style.flex = '1';
      leadFormContainer.style.flexDirection = 'column';
      leadFormContainer.style.overflow = 'hidden';

      if (collectedFields.city) leadFormData.city = collectedFields.city;
      if (collectedFields.serviceType) leadFormData.serviceType = collectedFields.serviceType;
      if (collectedFields.state) leadFormData.state = collectedFields.state;

      renderLeadFormStep();
    }

    function renderLeadFormStep() {
      var html = '';
      html += '<div class="kokobot-lead-form">';
      html += '<h3>Get a Free Estimate</h3>';
      html += '<div class="subtitle">Leave your details and we\'ll get back to you.</div>';
      html += '<div class="kokobot-lf-fields">';
      html += formFieldHTML('name', 'Full Name', 'text', leadFormData.name);
      html += formFieldHTML('phone', 'Phone Number', 'tel', leadFormData.phone);
      html += formFieldHTML('email', 'Email Address', 'email', leadFormData.email);
      html += '</div>';
      html += '<div class="kokobot-lf-buttons">';
      html += '<button class="kokobot-lf-btn-primary" id="kokobot-lf-submit">Send Request</button>';
      html += '</div>';
      if (Object.keys(leadFormErrors).length > 0) {
        var firstError = leadFormErrors[Object.keys(leadFormErrors)[0]];
        if (firstError) html += '<div class="kokobot-lf-error">' + escHtml(firstError) + '</div>';
      }
      html += '</div>';
      leadFormContainer.innerHTML = html;
      bindLeadFormEvents();
    }

    function formFieldHTML(field, label, type, value) {
      var err = leadFormErrors[field] || '';
      var html = '<div class="kokobot-lf-field">';
      html += '<label for="kokobot-lf-' + escHtml(field) + '">' + escHtml(label) + '</label>';
      html += '<input type="' + escHtml(type) + '" id="kokobot-lf-' + escHtml(field) + '" value="' + escHtml(value) + '" />';
      if (err) html += '<div class="error">' + escHtml(err) + '</div>';
      html += '</div>';
      return html;
    }

    function formSelectHTML(field, label, options, value) {
      var err = leadFormErrors[field] || '';
      var html = '<div class="kokobot-lf-field">';
      html += '<label for="kokobot-lf-' + escHtml(field) + '">' + escHtml(label) + '</label>';
      html += '<select id="kokobot-lf-' + escHtml(field) + '">';
      html += '<option value="">Select ' + escHtml(label.toLowerCase()) + '</option>';
      for (var i = 0; i < options.length; i++) {
        var sel = options[i] === value ? ' selected' : '';
        html += '<option value="' + escHtml(options[i]) + '"' + sel + '>' + escHtml(options[i]) + '</option>';
      }
      html += '</select>';
      if (err) html += '<div class="error">' + escHtml(err) + '</div>';
      html += '</div>';
      return html;
    }

    function readLeadFormFields() {
      var el;
      el = document.getElementById('kokobot-lf-name');
      if (el) leadFormData.name = el.value;
      el = document.getElementById('kokobot-lf-phone');
      if (el) leadFormData.phone = el.value;
      el = document.getElementById('kokobot-lf-email');
      if (el) leadFormData.email = el.value;
    }


    function submitLeadForm() {
      readLeadFormFields();
      if (!validateLeadStep(1)) {
        renderLeadFormStep();
        return;
      }

      var submitBtn = document.getElementById('kokobot-lf-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      // Send via mailto (no backend needed)
      var subject = encodeURIComponent('New Gate Estimate Request');
      var body = encodeURIComponent(
        'Name: ' + leadFormData.name + '\n' +
        'Phone: ' + leadFormData.phone + '\n' +
        'Email: ' + leadFormData.email + '\n' +
        'City: ' + (collectedFields.city || '') + '\n' +
        'State: ' + (collectedFields.state || '') + '\n' +
        'Service: ' + (collectedFields.serviceType || '')
      );
      window.location.href = 'mailto:info@interactivegates.com?subject=' + subject + '&body=' + body;

      leadSubmitted = true;
      leadFormContainer.innerHTML =
        '<div class="kokobot-success-view">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '<h3>Thank You!</h3>' +
          '<p>A specialist will contact you soon.</p>' +
          '<button id="kokobot-lf-done">Close</button>' +
        '</div>';
      document.getElementById('kokobot-lf-done').addEventListener('click', function () {
        hideLeadForm();
        showMessages();
        addMessage("Thank you for leaving your details, we will get back to you as soon as possible.", 'bot');
        addQuickReply(['Browse Questions & Answers', 'Start Over']);
        showInputArea(true);
      });
    }
    function bindLeadFormEvents() {
      var backBtn = document.getElementById('kokobot-lf-back');
      var nextBtn = document.getElementById('kokobot-lf-next');
      var submitBtn = document.getElementById('kokobot-lf-submit');

      if (backBtn) {
        backBtn.addEventListener('click', function () {
          readLeadFormFields();
          leadFormStep--;
          leadFormErrors = {};
          renderLeadFormStep();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          readLeadFormFields();
          if (validateLeadStep(leadFormStep)) {
            leadFormStep++;
            leadFormErrors = {};
            renderLeadFormStep();
          } else {
            renderLeadFormStep();
          }
        });
      }

      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          submitLeadForm();
        });
      }

      /* ─── Enter key support ─── */
      var inputs = leadFormContainer.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var n = document.getElementById('kokobot-lf-next');
            var s = document.getElementById('kokobot-lf-submit');
            if (n) n.click();
            else if (s) s.click();
          }
        });
      }
    }

    /* ─── Send ─── */
    function handleSend(text) {
      if (!text || !text.trim()) return;
      text = text.trim();
      addMessage(text, 'user');
      if (input) input.value = '';
      removeQuickReplies();
      addTyping();
      processUserMessage(text);
    }

    /* ─── Events ─── */
    bubble.addEventListener('click', toggle);
    closeBtn.addEventListener('click', toggle);

    sendBtn.addEventListener('click', function () {
      var val = input ? input.value : '';
      handleSend(val);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var val = input ? input.value : '';
        handleSend(val);
      }
    });
  }

  /* ─── Init ─── */
  try {
    injectStyles();
    var root = injectHTML();
    renderBubble(root);
    initChat(root);
  } catch (e) {
    logError('init', e);
  }
})();
