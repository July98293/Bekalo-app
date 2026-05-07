// ── SVG icon constants ──────────────────────────────────────────────
const IC = {
  lightning:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  flame:        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  heart:        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  wind:         `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  target:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  droplet:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  moon:         `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  shield:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  brain:        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
  bigLightning: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  teamIcon:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};

// ── Auth ─────────────────────────────────────────────────────────────
const authScreen   = document.getElementById('auth-screen');
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError   = document.getElementById('login-error');
const regError     = document.getElementById('reg-error');
const tabLogin     = document.getElementById('tab-login');
const tabRegister  = document.getElementById('tab-register');
const userRow      = document.getElementById('user-row');
const userAvatar   = document.getElementById('user-avatar');
const userName     = document.getElementById('user-name');
const logoutBtn    = document.getElementById('logout-btn');

let currentUser = null;

function getToken() { return localStorage.getItem('bekalo_token'); }
function setToken(t) { localStorage.setItem('bekalo_token', t); }
function clearToken() { localStorage.removeItem('bekalo_token'); }

function showAuthScreen() {
  authScreen.classList.remove('hidden');
  userRow.style.display = 'none';
  currentUser = null;
}

function hideAuthScreen(user) {
  authScreen.classList.add('hidden');
  currentUser = user;
  userRow.style.display = 'flex';
  userAvatar.textContent = (user.name?.[0] ?? '?').toUpperCase();
  userName.textContent = user.name;
}

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active'); tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
});
tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active'); tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const res = await apiNoAuth('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(res.token);
    hideAuthScreen(res.user);
    await boot();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  regError.classList.add('hidden');
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const res = await apiNoAuth('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    setToken(res.token);
    hideAuthScreen(res.user);
    await boot();
  } catch (err) {
    regError.textContent = err.message;
    regError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  rosterView.innerHTML = '';
  rosterView.classList.add('hidden');
  sidebarTeamsEl.innerHTML = '';
  pageTitle.textContent = 'Select a team';
  pageSub.textContent   = 'Create or select a team from the sidebar';
  topBarActions.innerHTML = '';
  activeTeamId = null;
  ovEl = null;
  showAuthScreen();
});

// ── API helpers ──────────────────────────────────────────────────────
async function apiNoAuth(path, opts = {}) {
  const res  = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data;
}

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(path, { headers, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearToken();
    showAuthScreen();
    throw new Error('Session expired — please sign in again');
  }
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data;
}

// ── Formatting helpers ───────────────────────────────────────────────
const fmt = (v, unit = '', na = 'N/A') =>
  (v === null || v === undefined) ? na : `${v}${unit ? ' ' + unit : ''}`;

function sbadge(color, label) {
  return `<span class="sbadge ${color}">${label}</span>`;
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function nameInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

// ── Ring gauge ───────────────────────────────────────────────────────
function ringHtml(score, color) {
  const r = 40, circ = 2 * Math.PI * r;
  const pct = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const off = circ - pct * circ;
  return `
    <div class="ring-wrap">
      <svg viewBox="0 0 96 96">
        <circle class="ring-track" cx="48" cy="48" r="${r}"/>
        <circle class="ring-fill ${color}" cx="48" cy="48" r="${r}"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
      </svg>
      <div class="ring-label">
        <span class="ring-score">${score ?? 'N/A'}</span>
        <span class="ring-denom">/ 100</span>
      </div>
    </div>`;
}

// ── Metric card ──────────────────────────────────────────────────────
function mCard(icon, title, mainVal, unit, badgeObj, rows = []) {
  const rowsHtml = rows.map(([l, v]) =>
    `<div class="m-row"><span class="l">${l}</span><span class="v">${v}</span></div>`
  ).join('');
  return `
    <div class="m-card">
      <div class="m-card-head">
        <span class="m-card-title">${title}</span>
        <span class="m-card-icon">${icon}</span>
      </div>
      <div class="m-main">
        <span class="m-val">${mainVal}</span>
        ${unit ? `<span class="m-unit">${unit}</span>` : ''}
      </div>
      ${badgeObj ? sbadge(badgeObj.color, badgeObj.label) : ''}
      ${rowsHtml ? `<div class="m-rows">${rowsHtml}</div>` : ''}
    </div>`;
}

// ── Performance radar chart ───────────────────────────────────────────
function radarChart(metrics) {
  const cx = 72, cy = 72, r = 48, n = metrics.length;
  const W = 144, H = 144;
  const angle = (i) => (90 - i * 360 / n) * Math.PI / 180;
  const toXY  = (i, f) => [cx + f * r * Math.cos(angle(i)), cy - f * r * Math.sin(angle(i))];

  const grid = [0.25, 0.5, 0.75, 1.0].map(f => {
    const pts = metrics.map((_, i) => toXY(i, f).map(v => v.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(0,0,0,${f === 1 ? 0.13 : 0.07})" stroke-width="${f === 1 ? 1 : 0.6}"/>`;
  }).join('');

  const axes = metrics.map((_, i) => {
    const [x2, y2] = toXY(i, 1).map(v => v.toFixed(1));
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(0,0,0,0.1)" stroke-width="0.7"/>`;
  }).join('');

  const norm = metrics.map(({ value, maxVal }) => Math.max(0, Math.min(1, (value ?? 0) / (maxVal ?? 100))));
  const dataPts = norm.map((f, i) => toXY(i, f).map(v => v.toFixed(1)).join(',')).join(' ');

  const dots = norm.map((f, i) => {
    const [px, py] = toXY(i, f).map(v => v.toFixed(1));
    return `<circle cx="${px}" cy="${py}" r="3" fill="var(--indigo)" opacity="0.85"/>`;
  }).join('');

  const lblOffset = r + 14;
  const labels = metrics.map(({ label, value, maxVal }, i) => {
    const [lx, ly] = toXY(i, 1 + lblOffset / r).map(v => v.toFixed(1));
    const pct = value !== null && value !== undefined ? Math.round((value / (maxVal ?? 100)) * 100) + '%' : 'N/A';
    return `<text x="${lx}" y="${parseFloat(ly) - 4}" text-anchor="middle" font-size="7.5" font-family="Inter,sans-serif" fill="rgba(0,0,0,0.55)" font-weight="600">${label}</text>
      <text x="${lx}" y="${parseFloat(ly) + 5}" text-anchor="middle" font-size="6.5" font-family="Inter,sans-serif" fill="rgba(0,0,0,0.35)">${pct}</text>`;
  }).join('');

  return `<div class="radar-wrap">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      ${grid}${axes}
      <polygon points="${dataPts}" fill="rgba(79,70,229,0.12)" stroke="var(--indigo)" stroke-width="1.5" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>
  </div>`;
}

// ── AI coaching note ──────────────────────────────────────────────────
async function fetchAINote(athleteId, dashData, container) {
  const noteEl = container.querySelector('.ai-note-section');
  if (!noteEl) return;
  noteEl.innerHTML = `<span class="ai-note-loading">${IC.brain} Analyzing player data…</span>`;
  const mf = dashData.matchFitness;
  const er = dashData.energyRecovery;
  const sf = dashData.stressFatigue;
  const sl = dashData.sleep;
  const hr = dashData.heartRate;
  const ir = dashData.injuryRisk;
  const prompt = `Analyze this football player's WHOOP biometrics and write a 2 to 3 sentence specific coaching recommendation. Match Fitness: ${mf?.score ?? 'N/A'}/100 (${mf?.status?.label}), Recovery: ${er?.recoveryScore ?? 'N/A'}/100, Sleep: ${sl?.score ?? 'N/A'}/100 (${sl?.totalHours ?? 'N/A'}h, ${sl?.deepMinutes ?? 'N/A'} min deep sleep), Strain: ${sf?.dailyStrain?.toFixed(1) ?? 'N/A'}/21, HRV: ${sf?.hrv?.toFixed(1) ?? 'N/A'} ms (${sf?.hrvStatus?.label ?? 'N/A'}), Resting HR: ${hr?.rhr ?? 'N/A'} bpm. Injury risk: ${ir?.status?.label}${ir?.factors?.length ? ', risk factors: ' + ir.factors.join(', ') : ', no critical factors'}.`;
  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: prompt, teamId: activeTeamId }),
    });
    noteEl.innerHTML = `<div class="ai-note-header">${IC.brain} Coaching Note</div><div class="ai-note-text">${res.reply}</div>`;
  } catch {
    noteEl.innerHTML = `<button class="ai-note-btn">${IC.brain} Get coaching note</button>`;
    const btn = noteEl.querySelector('.ai-note-btn');
    if (btn) btn.addEventListener('click', () => fetchAINote(athleteId, dashData, container));
  }
}

// ── Dashboard renderer ───────────────────────────────────────────────
function renderDashboard(d) {
  if (!d || d.noData) {
    return `<div class="no-data-panel">
      <strong>${d && !d.whoopConnected ? 'WHOOP not connected' : 'No data yet'}</strong>
      <p>${d && !d.whoopConnected
        ? 'Click "Connect WHOOP" to link this athlete\'s device.'
        : 'Click "Sync" to fetch the latest data from WHOOP.'}</p>
    </div>`;
  }

  const { matchFitness: mf, energyRecovery: er, stressFatigue: sf,
          heartRate: hr, sprintIntensity: sp, hydration: hy, sleep: sl,
          injuryRisk: ir, athlete: ath } = d;
  const ts = d.fetchedAt ? new Date(d.fetchedAt).toLocaleString('en-GB') : '';

  const C = { green:'#4ade80', yellow:'#fbbf24', orange:'#fb923c', red:'#f87171', gray:'#9ca3af' };
  const clr = c => C[c] || C.gray;
  const n = v => v !== null && v !== undefined ? v : 'N/A';
  const mkBar = (val, max, color) => {
    const w = val !== null ? Math.min(100,(val/max)*100).toFixed(0) : 0;
    return `<div class="pa-mbar"><div class="pa-mbar-fill" style="width:${w}%;background:${clr(color)}"></div></div>`;
  };

  // ── Top bar ──────────────────────────────────────────────────────────
  const topBar = `
    <div class="pa-topbar">
      <div class="pa-topbar-left">
        <div class="pa-role-badge" style="background:${clr(mf.status.color)}">${(ath?.role ?? 'POS').split(/\s+/)[0].slice(0,3).toUpperCase()}</div>
        <div>
          <div class="pa-player-name">${ath?.firstName ?? ''} ${ath?.lastName ?? ''}</div>
          <div class="pa-player-meta">${ath?.role ?? ''}${ath?.weight ? ', ' + ath.weight + ' kg' : ''}</div>
        </div>
      </div>
      <div class="pa-topbar-center">
        <div class="pa-big-score" style="color:${clr(mf.status.color)}">${mf.score ?? 'N/A'}</div>
        <div class="pa-big-lbl">${mf.status.label.toUpperCase()}</div>
      </div>
      <div class="pa-topbar-right">
        <div class="pa-bio-chip"><span class="pa-bio-v">${sf.hrv !== null ? sf.hrv.toFixed(1) : 'N/A'}</span><span class="pa-bio-u">ms</span><span class="pa-bio-l">HRV</span></div>
        <div class="pa-bio-chip"><span class="pa-bio-v">${n(hr.rhr)}</span><span class="pa-bio-u">bpm</span><span class="pa-bio-l">Rest HR</span></div>
        <div class="pa-bio-chip pa-bio-soon"><span class="pa-bio-v">N/A</span><span class="pa-bio-u">ng/mL</span><span class="pa-bio-l">Cortisol</span></div>
        <div class="pa-bio-chip pa-bio-soon"><span class="pa-bio-v">N/A</span><span class="pa-bio-u">mM</span><span class="pa-bio-l">Lactate</span></div>
      </div>
    </div>`;

  // ── Source pills ─────────────────────────────────────────────────────
  const pills = `
    <div class="pa-source-row">
      <span class="pa-pill pa-pill-on">WHOOP</span>
      <span class="pa-pill pa-pill-soon">Catapult <span class="cs-tag">COMING SOON</span></span>
      <span class="pa-pill pa-pill-on">Bekalo AI</span>
      <span class="pa-pill pa-pill-soon">GPS <span class="cs-tag">COMING SOON</span></span>
      <span class="pa-pill pa-pill-soon">Hormones <span class="cs-tag">COMING SOON</span></span>
    </div>`;

  // ── Injury risk alert bar ────────────────────────────────────────────
  const riskBar = ir.factors.length > 0 ? `
    <div class="pa-risk-bar pa-risk-${ir.status.color}">
      ${IC.shield} INJURY RISK: ${ir.status.label.toUpperCase()} — ${ir.factors.join(', ')}
    </div>` : '';

  // ── AI Plan card (dark) ──────────────────────────────────────────────
  const aiCard = `
    <div class="pa-ai-card">
      <div class="pa-ai-header">
        <span class="pa-ai-icon">${IC.brain}</span>
        <span class="pa-ai-title">AI PERSONALISED PLAN</span>
        <span class="pa-ai-brand">Bekalo AI</span>
        ${ts ? `<span class="pa-ai-time">${ts}</span>` : ''}
      </div>
      <div class="pa-ai-rec">${mf.recommendation}</div>
      <div class="ai-note-section"><button class="ai-note-btn">${IC.brain} Get personalised coaching note</button></div>
    </div>`;

  // ── Injury history (COMING SOON) ─────────────────────────────────────
  const injuryPanel = `
    <div class="pa-panel">
      <div class="pa-panel-head">${IC.shield} INJURY HISTORY <span class="cs-badge">COMING SOON</span></div>
      <div class="pa-cs-rows">
        <div class="pa-cs-row"><span class="pa-cs-dot" style="background:#ca8a04"></span><span>Hamstring</span><span class="pa-cs-dur">25d</span></div>
        <div class="pa-cs-row"><span class="pa-cs-dot" style="background:#3b82f6"></span><span>Hip flexor</span><span class="pa-cs-dur">14d</span></div>
      </div>
    </div>`;

  // ── WHOOP metrics ────────────────────────────────────────────────────
  const metricsPanel = `
    <div class="pa-panel">
      <div class="pa-panel-head">${IC.lightning} TODAY'S METRICS</div>
      <div class="pa-mrow"><span class="pa-mlbl">Recovery</span>${mkBar(er.recoveryScore,100,er.status.color)}<span class="pa-mval">${n(er.recoveryScore)}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Sleep quality</span>${mkBar(sl.score,100,sl.status.color)}<span class="pa-mval">${n(sl.score)}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Sleep duration</span>${mkBar(sl.totalHours,9,'green')}<span class="pa-mval">${sl.totalHours !== null ? sl.totalHours + 'h' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Deep sleep</span><span class="pa-mval" style="margin-left:auto">${sl.deepMinutes !== null ? sl.deepMinutes + ' min' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">REM sleep</span><span class="pa-mval" style="margin-left:auto">${sl.remMinutes !== null ? sl.remMinutes + ' min' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Daily strain</span>${mkBar(sf.dailyStrain,21,sf.status.color)}<span class="pa-mval">${sf.dailyStrain !== null ? sf.dailyStrain.toFixed(1) : 'N/A'} / 21</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">HRV</span>${mkBar(sf.hrv,100,sf.hrvStatus?.color ?? 'gray')}<span class="pa-mval">${sf.hrv !== null ? sf.hrv.toFixed(1) + ' ms' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Resting HR</span><span class="pa-mval" style="margin-left:auto">${hr.rhr !== null ? hr.rhr + ' bpm' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Avg HR</span><span class="pa-mval" style="margin-left:auto">${hr.avgHR !== null ? hr.avgHR + ' bpm' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Peak HR</span><span class="pa-mval" style="margin-left:auto">${hr.maxHR !== null ? hr.maxHR + ' bpm' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Sprint intensity</span>${mkBar(sp.maxHRPct,100,sp.status.color)}<span class="pa-mval">${sp.maxHRPct !== null ? sp.maxHRPct + '% max HR' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">SpO₂</span>${mkBar(hy.spo2,100,hy.status.color)}<span class="pa-mval">${hy.spo2 !== null ? hy.spo2.toFixed(1) + '%' : 'N/A'}</span></div>
      <div class="pa-mrow"><span class="pa-mlbl">Calories</span><span class="pa-mval" style="margin-left:auto">${er.calories !== null ? er.calories + ' kcal' : 'N/A'}</span></div>
    </div>`;

  // ── Biomarker trace (COMING SOON) ────────────────────────────────────
  const bioTrace = `
    <div class="pa-panel pa-cs-panel">
      <div class="pa-panel-head">${IC.flame} BIOMARKER TRACE <span class="pa-sub">24h live, cortisol, lactate</span> <span class="cs-badge">COMING SOON</span></div>
      <div class="pa-chart-ph">
        <svg viewBox="0 0 320 72" class="pa-cs-chart">
          <path d="M0,56 C20,52 40,40 60,44 C80,48 100,32 120,36 C140,40 160,28 180,32 C200,36 220,44 240,40 C260,36 280,42 320,38" fill="rgba(239,68,68,0.07)" stroke="rgba(239,68,68,0.3)" stroke-width="1.8"/>
          <path d="M0,65 C40,63 80,60 120,62 C160,64 200,58 240,61 L320,63" fill="none" stroke="rgba(34,211,238,0.3)" stroke-width="1.5" stroke-dasharray="4,2"/>
        </svg>
        <div class="pa-cs-overlay"><span class="cs-badge cs-badge-lg">COMING SOON</span><p>Cortisol, lactate and hormonal biomarker tracking</p></div>
      </div>
    </div>`;

  // ── Readiness trajectory (COMING SOON) ───────────────────────────────
  const readTraj = `
    <div class="pa-panel pa-cs-panel">
      <div class="pa-panel-head">${IC.target} READINESS TRAJECTORY <span class="pa-sub">personalised 30d baseline</span> <span class="cs-badge">COMING SOON</span></div>
      <div class="pa-chart-ph">
        <svg viewBox="0 0 320 56" class="pa-cs-chart">
          <line x1="0" y1="18" x2="320" y2="18" stroke="rgba(0,0,0,0.08)" stroke-width="1" stroke-dasharray="4,3"/>
          <path d="M0,16 L60,20 L120,28 L180,34 L240,40 L320,44" fill="none" stroke="rgba(239,68,68,0.4)" stroke-width="2"/>
          <circle cx="0"   cy="16" r="3" fill="rgba(239,68,68,0.5)"/>
          <circle cx="120" cy="28" r="3" fill="rgba(239,68,68,0.5)"/>
          <circle cx="240" cy="40" r="3" fill="rgba(239,68,68,0.5)"/>
          <circle cx="320" cy="44" r="3" fill="rgba(239,68,68,0.5)"/>
        </svg>
        <div class="pa-cs-overlay"><span class="cs-badge cs-badge-lg">COMING SOON</span><p>30-day readiness baseline and trend tracking</p></div>
      </div>
    </div>`;

  // ── Performance profile radar ─────────────────────────────────────────
  const perfPanel = `
    <div class="pa-panel">
      <div class="pa-panel-head">${IC.target} PERFORMANCE PROFILE <span class="pa-sub">vs personal baseline</span></div>
      ${radarChart([
        { label: 'Recovery', value: er.recoveryScore, maxVal: 100 },
        { label: 'Sleep',    value: sl.score,         maxVal: 100 },
        { label: 'HRV',      value: sf.hrv,           maxVal: 100 },
        { label: 'Load',     value: sf.dailyStrain,   maxVal: 21  },
        { label: 'Sprint',   value: sp.maxHRPct,      maxVal: 100 },
      ])}
    </div>`;

  // ── GPS / GPS data (COMING SOON) ──────────────────────────────────────
  const gpsPanel = `
    <div class="pa-panel pa-cs-panel" style="margin-top:0">
      <div class="pa-panel-head">${IC.wind} GPS, LOAD & GPS DATA <span class="cs-badge">COMING SOON</span></div>
      <div class="pa-cs-chips">
        <div class="pa-cs-chip"><span class="pa-cs-chip-v">142</span><span class="pa-cs-chip-l">km distance</span></div>
        <div class="pa-cs-chip"><span class="pa-cs-chip-v">5.2</span><span class="pa-cs-chip-l">max speed m/s</span></div>
        <div class="pa-cs-chip"><span class="pa-cs-chip-v">38</span><span class="pa-cs-chip-l">sprints</span></div>
        <div class="pa-cs-chip"><span class="pa-cs-chip-v">N/A</span><span class="pa-cs-chip-l">ACWR</span></div>
      </div>
    </div>`;

  return `
    ${topBar}
    ${pills}
    ${riskBar}
    ${aiCard}
    <div class="pa-main-grid">
      <div class="pa-col-left">
        ${injuryPanel}
        ${metricsPanel}
      </div>
      <div class="pa-col-center">
        ${bioTrace}
        ${readTraj}
      </div>
      <div class="pa-col-right">
        ${perfPanel}
        ${gpsPanel}
      </div>
    </div>
    ${ts ? `<p class="sync-info">Last synced: ${ts}</p>` : ''}`;
}

// ── Quick stats bar ──────────────────────────────────────────────────
function updateQuickStats(cardEl, d) {
  const bar = cardEl.querySelector('.ac-quick');
  if (!d || d.noData) { bar.classList.add('hidden'); return; }

  const { matchFitness: mf, energyRecovery: er, sleep: sl, stressFatigue: sf, heartRate: hr } = d;

  bar.querySelector('.fitness-val').textContent  = mf.score !== null  ? mf.score  : 'N/A';
  bar.querySelector('.recovery-val').textContent = er.recoveryScore !== null ? er.recoveryScore : 'N/A';
  bar.querySelector('.sleep-val').textContent    = sl.score !== null  ? sl.score  : 'N/A';
  bar.querySelector('.strain-val').textContent   = sf.dailyStrain !== null ? sf.dailyStrain.toFixed(1) : 'N/A';
  bar.querySelector('.rhr-val').textContent      = hr.rhr !== null    ? `${hr.rhr} bpm` : 'N/A';

  const rb = bar.querySelector('.readiness-badge');
  rb.textContent = mf.status.label;
  const colorMap = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)', gray: 'var(--text3)' };
  rb.style.color       = colorMap[mf.status.color] || colorMap.gray;
  rb.style.borderColor = colorMap[mf.status.color] || colorMap.gray;
  rb.style.background  = `${colorMap[mf.status.color] || colorMap.gray}18`;
  bar.classList.remove('hidden');
}

// ── Pitch visualization ───────────────────────────────────────────────
const ZONE_Y = { gk: 88, def: 72, defmid: 59, mid: 46, wing: 35, attmid: 24, fwd: 12 };

function classifyPosition(role) {
  if (!role) return 'mid';
  const r = role.toLowerCase();
  if (/\bgk\b|goalkeeper|portiere|keeper/.test(r)) return 'gk';
  if (/\bcdm\b|\bdm\b|defensive.?mid|mediano/.test(r)) return 'defmid';
  if (/\blb\b|\brb\b|\bcb\b|full.?back|terzino|difensore|stopper|libero|defens/.test(r)) return 'def';
  if (/\blw\b|\brw\b|winger|ala\b/.test(r)) return 'wing';
  if (/\bcam\b|\bss\b|attack.?mid|trequar|fantasist/.test(r)) return 'attmid';
  if (/\bst\b|\bcf\b|strik|forward|attacc|centravant|punta/.test(r)) return 'fwd';
  if (/mid|centro/.test(r)) return 'mid';
  return 'mid';
}

function layoutPlayersOnPitch(players) {
  const groups = {};
  players.forEach(p => {
    const z = classifyPosition(p.role);
    (groups[z] = groups[z] || []).push(p);
  });
  const result = [];
  for (const [zone, group] of Object.entries(groups)) {
    const yPct = ZONE_Y[zone] ?? 50;
    const n = group.length;
    group.forEach((p, i) => {
      const xPct = n === 1 ? 50 : 12 + (i / (n - 1)) * 76;
      result.push({ ...p, xPct, yPct });
    });
  }
  return result;
}

function shortName(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 9 ? last.slice(0, 9) : last;
}

function renderPitchSVG(allPlayers) {
  const W = 186, H = 272;
  const M = 12;
  const PW = W - M * 2, PH = H - M * 2;

  const paW = Math.round(PW * 0.56), paH = Math.round(PH * 0.165);
  const gaW = Math.round(PW * 0.30), gaH = Math.round(PH * 0.07);
  const paX = M + Math.round((PW - paW) / 2);
  const gaX = M + Math.round((PW - gaW) / 2);
  const ccR = Math.round(PH * 0.085);
  const crA = Math.round(PH * 0.022);

  const DOT = { green:'#4ade80', yellow:'#fbbf24', orange:'#fb923c', red:'#f87171', gray:'#d1d5db' };

  const stripes = Array.from({length: 7}, (_, i) => {
    const y = M + Math.round(i * PH / 7);
    const h = Math.round(PH / 14);
    return `<rect x="${M}" y="${y}" width="${PW}" height="${h}" fill="rgba(255,255,255,0.04)"/>`;
  }).join('');

  const lines = `
    <rect x="${M}" y="${M}" width="${PW}" height="${PH}" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.3"/>
    <line x1="${M}" y1="${H/2}" x2="${W-M}" y2="${H/2}" stroke="rgba(255,255,255,0.65)" stroke-width="1.1"/>
    <circle cx="${W/2}" cy="${H/2}" r="${ccR}" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.1"/>
    <circle cx="${W/2}" cy="${H/2}" r="2" fill="rgba(255,255,255,0.8)"/>
    <rect x="${paX}" y="${M}" width="${paW}" height="${paH}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.1"/>
    <rect x="${paX}" y="${M+PH-paH}" width="${paW}" height="${paH}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.1"/>
    <rect x="${gaX}" y="${M}" width="${gaW}" height="${gaH}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>
    <rect x="${gaX}" y="${M+PH-gaH}" width="${gaW}" height="${gaH}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>
    <circle cx="${W/2}" cy="${M+Math.round(paH*0.7)}" r="1.5" fill="rgba(255,255,255,0.7)"/>
    <circle cx="${W/2}" cy="${M+PH-Math.round(paH*0.7)}" r="1.5" fill="rgba(255,255,255,0.7)"/>
    <path d="M ${M} ${M+crA} A ${crA} ${crA} 0 0 1 ${M+crA} ${M}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>
    <path d="M ${W-M-crA} ${M} A ${crA} ${crA} 0 0 1 ${W-M} ${M+crA}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>
    <path d="M ${W-M} ${H-M-crA} A ${crA} ${crA} 0 0 1 ${W-M-crA} ${H-M}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>
    <path d="M ${M+crA} ${H-M} A ${crA} ${crA} 0 0 1 ${M} ${H-M-crA}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.9"/>`;

  const positioned = layoutPlayersOnPitch(allPlayers);
  const dots = positioned.map(p => {
    const cx = Math.round((p.xPct / 100) * W);
    const cy = Math.round((p.yPct / 100) * H);
    const fill = DOT[p.statusColor] || DOT.gray;
    const initials = (p.name || '?').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    const label = shortName(p.name);
    const op = p.synced ? 1 : 0.5;
    return `<g transform="translate(${cx},${cy})" opacity="${op}">
      <circle r="11" fill="${fill}" stroke="white" stroke-width="1.5"/>
      <text text-anchor="middle" dominant-baseline="central" font-size="7.5" font-weight="700" fill="white" font-family="Inter,system-ui,sans-serif">${initials}</text>
      <text text-anchor="middle" y="18" font-size="6.5" font-weight="600" fill="white" font-family="Inter,system-ui,sans-serif" opacity="0.92">${label}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="tov-pitch-svg">
    <rect width="${W}" height="${H}" fill="#166534" rx="6"/>
    ${stripes}${lines}${dots}
  </svg>`;
}

// ── Team overview ────────────────────────────────────────────────────
let ovEl = null;

// ── Next match localStorage helpers ──────────────────────────────────
function getNextMatch() {
  if (activeTeamId === null) return null;
  try { return JSON.parse(localStorage.getItem(`bk_match_${activeTeamId}`) || 'null'); } catch { return null; }
}
function saveNextMatch(m) { localStorage.setItem(`bk_match_${activeTeamId}`, JSON.stringify(m)); }
function clearNextMatch()  { localStorage.removeItem(`bk_match_${activeTeamId}`); }

function daysTo(dateStr) {
  const diff = Math.round((new Date(dateStr) - new Date()) / 86400000);
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Today';
  return `MD-${diff}`;
}

function nextMatchHTML() {
  const m = getNextMatch();
  if (!m) return `
    <div class="tov2-nm-card">
      <div class="tov2-nm-head">${IC.target} NEXT MATCH</div>
      <div id="tov2-nm-show"><button class="btn btn-ghost btn-sm tov2-add-btn">+ Add next game</button></div>
      <form id="tov2-game-form" class="tov2-game-form hidden">
        <input name="opponent" placeholder="Opponent team" required autocomplete="off"/>
        <input name="matchDate" type="datetime-local" required/>
        <input name="location" placeholder="City or venue (e.g. Milan)" autocomplete="off"/>
        <div class="tov2-form-actions">
          <button type="submit" class="btn btn-primary btn-sm" style="flex:1">Save</button>
          <button type="button" class="btn btn-ghost btn-sm tov2-cancel-btn">Cancel</button>
        </div>
      </form>
    </div>`;
  const days = daysTo(m.matchDate);
  const dt = new Date(m.matchDate);
  const dateStr = dt.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
  const timeStr = dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const weatherBlock = m.location
    ? `<div id="nm-weather-block" class="tov2-nm-weather-block"><span class="tov2-nm-weather-loading">Loading weather…</span></div>`
    : '';
  return `
    <div class="tov2-nm-card">
      <div class="tov2-nm-head">${IC.target} NEXT MATCH <button class="tov2-clear-btn" title="Remove">✕</button></div>
      <div class="tov2-nm-count">${days}</div>
      <div class="tov2-nm-vs">vs <strong>${m.opponent}</strong></div>
      <div class="tov2-nm-meta">${dateStr}, ${timeStr}${m.location ? ' · ' + m.location : ''}</div>
      ${weatherBlock}
      <button class="btn btn-ghost btn-sm tov2-edit-btn" style="margin-top:6px;font-size:10px">Edit</button>
    </div>`;
}

async function fetchAndShowWeather() {
  if (!ovEl) return;
  const m = getNextMatch();
  const block = ovEl.querySelector('#nm-weather-block');
  if (!block || !m?.location || !m?.matchDate) return;

  try {
    const w = await api(`/api/weather?location=${encodeURIComponent(m.location)}&date=${encodeURIComponent(m.matchDate)}`);
    if (!w.available) {
      const msg = w.reason === 'too_far'
        ? `${w.locationName} · Forecast available within 16 days`
        : `${w.locationName} · Match already past`;
      block.innerHTML = `<span class="tov2-nm-weather-na">${msg}</span>`;
      return;
    }
    block.innerHTML = `
      <div class="tov2-nm-weather-row">
        <span class="tov2-nm-weather-emoji">${w.emoji}</span>
        <div class="tov2-nm-weather-info">
          <span class="tov2-nm-weather-main">${w.condition} · ${w.temperature}°C</span>
          <span class="tov2-nm-weather-detail">Rain ${w.precipitation}% · Wind ${w.windspeed} km/h</span>
          <span class="tov2-nm-weather-loc">${w.locationName}</span>
        </div>
      </div>`;
  } catch {
    block.innerHTML = `<span class="tov2-nm-weather-na">Weather unavailable</span>`;
  }
}

function buildTeamOverviewHTML(ov) {
  const {
    teamName, teamFitness, statusColor, statusLabel, totalPlayers, syncedPlayers,
    avgRecovery, avgSleep, avgStrain, avgHrv, avgSprintPct,
    readyCount, moderateCount, lowCount, readinessPct,
    highStrainCount, modStrainCount, lightStrainCount,
    atRisk, allPlayers,
  } = ov;

  const sc = statusColor || 'gray';
  const nv = v => v !== null && v !== undefined ? v : 'N/A';

  const distTotal   = readyCount + moderateCount + lowCount;
  const strainTotal = highStrainCount + modStrainCount + lightStrainCount;
  const rPct  = distTotal ? (readyCount    / distTotal * 100).toFixed(1) : 0;
  const mPct  = distTotal ? (moderateCount / distTotal * 100).toFixed(1) : 0;
  const lPct  = distTotal ? (lowCount      / distTotal * 100).toFixed(1) : 0;
  const hPct  = strainTotal ? (highStrainCount  / strainTotal * 100).toFixed(1) : 0;
  const mdPct = strainTotal ? (modStrainCount   / strainTotal * 100).toFixed(1) : 0;
  const lsPct = strainTotal ? (lightStrainCount / strainTotal * 100).toFixed(1) : 0;

  // ── Squad Ready card ─────────────────────────────────────────────────
  const squadCard = `
    <div class="tov2-squad">
      <div class="tov2-squad-lbl">SQUAD READY</div>
      <div class="tov2-squad-score">
        <span class="tov2-squad-num tov2-sc-${sc}">${teamFitness ?? 'N/A'}</span>
        <span class="tov2-squad-denom">/100</span>
      </div>
      <div class="tov2-squad-dots">
        <span class="tov2-dot green"></span>${readyCount}
        <span class="tov2-dot yellow"></span>${moderateCount}
        <span class="tov2-dot red"></span>${lowCount}
      </div>
      <div class="tov2-kpis">
        <div class="tov2-kpi"><div class="tov2-kpi-v">${nv(avgRecovery)}</div><div class="tov2-kpi-l">Recovery</div></div>
        <div class="tov2-kpi"><div class="tov2-kpi-v">${nv(avgHrv)}</div><div class="tov2-kpi-l">HRV ms</div></div>
        <div class="tov2-kpi"><div class="tov2-kpi-v">${nv(avgSleep)}</div><div class="tov2-kpi-l">Sleep</div></div>
        <div class="tov2-kpi"><div class="tov2-kpi-v">${nv(avgStrain)}</div><div class="tov2-kpi-l">Strain</div></div>
      </div>
    </div>`;

  // ── AI Pre-Match Briefing (dark) ─────────────────────────────────────
  const aiBrief = `
    <div class="tov2-ai-brief">
      <div class="tov2-ai-head">
        <span class="tov2-ai-dot"></span>
        <span class="tov2-ai-title">AI PRE-MATCH BRIEFING</span>
        <span class="tov2-ai-brand">Bekalo AI</span>
      </div>
      <div class="tov2-ai-body">
        ${atRisk.length > 0
          ? `<span class="tov2-ai-alert">${atRisk.length} player${atRisk.length > 1 ? 's' : ''}</span> at high injury risk: ${atRisk.map(p => p.name.split(' ').pop()).join(', ')}. `
          : 'No critical injury risks detected. '}${readinessPct !== null
          ? `${readinessPct}% of the squad is match-ready.`
          : 'Sync players to generate the briefing.'}
      </div>
      ${syncedPlayers > 0 ? `<div class="tov2-ai-btn-row"><button class="ai-note-btn tov2-gen-btn">${IC.brain} Generate full briefing</button></div>` : ''}
    </div>`;

  // ── Squad mini strip ──────────────────────────────────────────────────
  const squadMini = `
    <div class="tov2-squad-mini">
      <div class="tov2-sm-score">
        <span class="tov2-squad-num tov2-sc-${sc}" style="font-size:30px;line-height:1">${teamFitness ?? 'N/A'}</span>
        <span class="tov2-squad-denom">/100</span>
      </div>
      <div class="tov2-sm-dots">
        <span class="tov2-dot green"></span>${readyCount}
        <span class="tov2-dot yellow"></span>${moderateCount}
        <span class="tov2-dot red"></span>${lowCount}
      </div>
      <div class="tov2-sm-kpis">
        <div class="tov2-sm-kpi"><span class="tov2-kpi-v">${nv(avgRecovery)}</span><span class="tov2-kpi-l">Rec</span></div>
        <div class="tov2-sm-kpi"><span class="tov2-kpi-v">${nv(avgHrv)}</span><span class="tov2-kpi-l">HRV</span></div>
        <div class="tov2-sm-kpi"><span class="tov2-kpi-v">${nv(avgSleep)}</span><span class="tov2-kpi-l">Sleep</span></div>
        <div class="tov2-sm-kpi"><span class="tov2-kpi-v">${nv(avgStrain)}</span><span class="tov2-kpi-l">Strain</span></div>
      </div>
    </div>`;

  // ── Pitch ─────────────────────────────────────────────────────────────
  const pitchSection = `
    <div class="tov2-tac">
      <div class="tov2-tac-header">
        <span class="tov2-tac-title">Tactical Board</span>
        <span class="tov2-tac-sub">Readiness view</span>
        <span class="cs-badge" style="margin-left:auto">Formation editor COMING SOON</span>
      </div>
      <div class="tov-pitch-wrap" style="border:none;padding:10px 10px 6px">
        ${(allPlayers && allPlayers.length > 0) ? renderPitchSVG(allPlayers) : '<div style="height:200px;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.25);font-size:11px">Add players to see pitch view</div>'}
        <div class="tov-pitch-legend">
          <span class="tov-legend-item"><span class="tov-legend-dot" style="background:#4ade80"></span>Ready</span>
          <span class="tov-legend-item"><span class="tov-legend-dot" style="background:#fbbf24"></span>Moderate</span>
          <span class="tov-legend-item"><span class="tov-legend-dot" style="background:#f87171"></span>Low</span>
          <span class="tov-legend-item"><span class="tov-legend-dot" style="background:#d1d5db"></span>No data</span>
        </div>
      </div>
      ${distTotal > 0 ? `<div style="padding:0 14px 12px">
        <div class="tov-dist-bar">
          <div class="tov-dist-seg green"  style="width:${rPct}%"></div>
          <div class="tov-dist-seg yellow" style="width:${mPct}%"></div>
          <div class="tov-dist-seg red"    style="width:${lPct}%"></div>
        </div>
        <div class="tov-dist-legend" style="margin-top:6px">
          <span class="tov-dist-item"><span class="tov-dot green"></span>${readyCount} Ready</span>
          <span class="tov-dist-item"><span class="tov-dot yellow"></span>${moderateCount} Moderate</span>
          <span class="tov-dist-item"><span class="tov-dot red"></span>${lowCount} Low</span>
        </div>
      </div>` : ''}
    </div>`;

  // ── Player roster list ────────────────────────────────────────────────
  const rosterRows = (allPlayers || []).map((p, i) => {
    const nameParts = p.name.split(' ');
    const initials2 = ((nameParts[0]?.[0] ?? '') + (nameParts[nameParts.length - 1]?.[0] ?? '')).toUpperCase();
    return `
      <div class="tov2-prow ${!p.synced ? 'tov2-prow-unsynced' : ''}">
        <div class="tov2-pnum">${i + 1}</div>
        <div class="tov2-pavatar tov2-pc-${p.statusColor}">${initials2}</div>
        <div class="tov2-pinfo">
          <div class="tov2-pname">${p.name}</div>
          <div class="tov2-prole">${p.role}</div>
        </div>
        <div class="tov2-pscore tov2-pc-${p.statusColor}">${p.matchFitness ?? 'N/A'}</div>
        <span class="tov-pbadge ${p.statusColor}">${p.statusLabel}</span>
      </div>`;
  }).join('');

  const rosterPanel = `
    <div class="tov2-roster">
      <div class="tov2-roster-tabs">
        <span class="tov2-rtab tov2-rtab-on">Available · ${totalPlayers - atRisk.length}</span>
        <span class="tov2-rtab" style="color:var(--red)">At Risk · ${atRisk.length}</span>
      </div>
      <div class="tov2-roster-list">${rosterRows}</div>
    </div>`;

  // ── Critical Alerts ───────────────────────────────────────────────────
  const alertsPanel = atRisk.length > 0 ? `
    <div class="tov2-alerts">
      <div class="tov2-alerts-head">${IC.shield} Critical Alerts <span class="tov2-alerts-count">${atRisk.length}</span></div>
      ${atRisk.map(p => `
        <div class="tov2-alert-row">
          <div>
            <div class="tov2-alert-name">${p.name}</div>
            <div class="tov2-alert-factors">${p.factors.join(', ')}</div>
          </div>
          <div class="tov2-alert-action">Reduce load</div>
        </div>`).join('')}
    </div>` : `
    <div class="tov2-alerts tov2-alerts-ok">
      <div class="tov2-alerts-head">${IC.shield} Critical Alerts <span class="tov2-alerts-count" style="background:rgba(22,163,74,0.15);color:var(--green)">0</span></div>
      <p style="font-size:12px;color:var(--text3);margin-top:8px">No critical injury risks detected</p>
    </div>`;

  // ── Team Load panel ───────────────────────────────────────────────────
  const loadPanel = `
    <div class="tov2-load">
      <div class="tov2-load-head">${IC.flame} Team Load · 7d</div>
      ${strainTotal > 0 ? `
        <div class="tov-load-row"><span class="tov-load-lbl">High (&ge;14)</span><div class="tov-load-bg"><div class="tov-load-fill red"    style="width:${hPct}%"></div></div><span class="tov-load-count">${highStrainCount}</span></div>
        <div class="tov-load-row"><span class="tov-load-lbl">Moderate</span><div class="tov-load-bg"><div class="tov-load-fill yellow" style="width:${mdPct}%"></div></div><span class="tov-load-count">${modStrainCount}</span></div>
        <div class="tov-load-row"><span class="tov-load-lbl">Light (&lt;7)</span><div class="tov-load-bg"><div class="tov-load-fill green"  style="width:${lsPct}%"></div></div><span class="tov-load-count">${lightStrainCount}</span></div>
      ` : '<p style="font-size:12px;color:var(--text3)">No strain data yet</p>'}
    </div>`;

  // ── High Risk section ─────────────────────────────────────────────────
  const highRiskSection = atRisk.length > 0 ? `
    <div class="tov2-high-risk">
      <div class="tov2-high-risk-head">${IC.shield} High Risk Players <span class="tov2-alerts-count">${atRisk.length}</span></div>
      <div class="tov2-hr-rows">
        ${atRisk.map(p => {
          const np = p.name.split(' ');
          const ini = ((np[0]?.[0] ?? '') + (np[np.length - 1]?.[0] ?? '')).toUpperCase();
          return `<div class="tov2-hr-row">
            <div class="tov2-pavatar tov2-pc-red">${ini}</div>
            <div class="tov2-hr-info">
              <div class="tov2-hr-name">${p.name}</div>
              <div class="tov2-prole">${p.role}</div>
            </div>
            <div class="tov2-hr-factors">${p.factors.join(', ')}</div>
            <div class="tov2-pscore tov2-pc-red">${p.matchFitness ?? 'N/A'}</div>
            <span class="tov-pbadge red">High Risk</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  return `
    <div class="tov2-banner">
      <div class="tov2-banner-tag">${IC.teamIcon} ${teamName}</div>
      <div class="tov2-banner-meta">${syncedPlayers} of ${totalPlayers} players synced with WHOOP</div>
      <span class="tov-status-pill ${sc}">${statusLabel}</span>
    </div>
    <div class="tov2-top-row">
      ${alertsPanel}
      ${aiBrief}
      ${nextMatchHTML()}
    </div>
    <div class="tov2-main-row">
      ${pitchSection}
      <div class="tov2-right-col">
        ${squadMini}
        ${rosterPanel}
      </div>
    </div>
    ${highRiskSection}
    ${loadPanel}`;
}

function wireTeamAIBtn() {
  const btn = ovEl?.querySelector('.tov2-gen-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const noteRow = ovEl.querySelector('.tov2-ai-btn-row');
    if (noteRow) noteRow.innerHTML = `<span class="ai-note-loading">${IC.brain} Generating briefing…</span>`;
    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Generate a concise pre-match briefing for this squad. Highlight injury risks, load management priorities and which players are ready for high-intensity play.', teamId: activeTeamId }),
      });
      const body = ovEl.querySelector('.tov2-ai-body');
      if (body) body.innerHTML = res.reply;
      if (noteRow) noteRow.remove();
    } catch { if (noteRow) noteRow.innerHTML = `<button class="ai-note-btn tov2-gen-btn">${IC.brain} Retry</button>`; wireTeamAIBtn(); }
  });
}

function wireNextMatchUI() {
  if (!ovEl) return;
  const addBtn   = ovEl.querySelector('.tov2-add-btn');
  const gameForm = ovEl.querySelector('#tov2-game-form');
  const showDiv  = ovEl.querySelector('#tov2-nm-show');
  const cancelBtn = ovEl.querySelector('.tov2-cancel-btn');
  const clearBtn = ovEl.querySelector('.tov2-clear-btn');
  const editBtn  = ovEl.querySelector('.tov2-edit-btn');

  if (addBtn) addBtn.addEventListener('click', () => {
    showDiv?.classList.add('hidden');
    gameForm?.classList.remove('hidden');
  });
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    gameForm?.classList.add('hidden');
    showDiv?.classList.remove('hidden');
  });
  if (gameForm) gameForm.addEventListener('submit', e => {
    e.preventDefault();
    saveNextMatch(Object.fromEntries(new FormData(e.target)));
    refreshTeamOverview();
  });
  if (clearBtn) clearBtn.addEventListener('click', () => { clearNextMatch(); refreshTeamOverview(); });
  if (editBtn) editBtn.addEventListener('click', () => { clearNextMatch(); refreshTeamOverview(); });
}

function wireTeamUI() {
  wireTeamAIBtn();
  wireNextMatchUI();
  fetchAndShowWeather();
}

function refreshTeamOverview() {
  if (!ovEl || activeTeamId === null) return;
  api(`/api/teams/${activeTeamId}/overview`).then(ov => {
    ovEl.innerHTML = buildTeamOverviewHTML(ov);
    wireTeamUI();
  }).catch(() => {});
}

// ── Athlete card ─────────────────────────────────────────────────────
function buildAthleteCard(teamId, athlete) {
  const tpl  = document.getElementById('athlete-card-tpl');
  const frag = tpl.content.cloneNode(true);
  const card = frag.querySelector('.athlete-card');

  card.dataset.athleteId = athlete.id;
  card.querySelector('.ac-initials').textContent = initials(athlete.firstName, athlete.lastName);
  card.querySelector('.ac-name').textContent     = `${athlete.firstName} ${athlete.lastName}`;
  card.querySelector('.ac-pos').textContent      = athlete.role;

  const whoopPill  = card.querySelector('.whoop-pill');
  const connectBtn = card.querySelector('.connect-btn');
  const syncBtn    = card.querySelector('.sync-btn');
  const deleteBtn  = card.querySelector('.delete-btn');
  const dashEl     = card.querySelector('.ac-dashboard');

  function setConnected(on) {
    whoopPill.textContent  = on ? '● WHOOP' : 'WHOOP';
    whoopPill.className    = `whoop-pill ${on ? 'connected' : 'disconnected'}`;
    connectBtn.textContent = on ? 'Reconnect' : 'Connect WHOOP';
  }
  setConnected(athlete.whoopConnected);

  connectBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `/auth/whoop/login?athleteId=${athlete.id}`;
  });

  function wireAIBtn(dashData) {
    const btn = dashEl.querySelector('.ai-note-btn');
    if (btn) btn.addEventListener('click', () => fetchAINote(athlete.id, dashData, dashEl));
  }

  async function loadDashboard() {
    try {
      const d = await api(`/api/athletes/${athlete.id}/dashboard`);
      dashEl.innerHTML = renderDashboard(d);
      updateQuickStats(card, d);
      wireAIBtn(d);
    } catch {
      dashEl.innerHTML = `<div class="no-data-panel"><strong>Failed to load data</strong></div>`;
    }
  }

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '↻ Syncing…';
    try {
      const res = await api(`/api/athletes/${athlete.id}/whoop/sync`, { method: 'POST' });
      setConnected(true);
      dashEl.innerHTML = renderDashboard(res.dashboard);
      updateQuickStats(card, res.dashboard);
      wireAIBtn(res.dashboard);
      refreshTeamOverview();
    } catch (err) { alert(err.message); }
    finally { syncBtn.disabled = false; syncBtn.textContent = '↻ Sync'; }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Remove ${athlete.firstName} ${athlete.lastName} from the roster?`)) return;
    deleteBtn.disabled = true;
    try {
      await api(`/api/athletes/${athlete.id}`, { method: 'DELETE' });
      const el = document.querySelector(`[data-athlete-id="${athlete.id}"]`);
      if (el) el.remove();
      refreshSidebarCount(teamId);
      refreshTeamOverview();
    } catch (err) {
      alert(err.message);
      deleteBtn.disabled = false;
    }
  });

  loadDashboard();
  return frag;
}

// ── Sidebar ──────────────────────────────────────────────────────────
let activeTeamId = null;
const sidebarTeamsEl = document.getElementById('sidebar-teams');
const rosterView     = document.getElementById('roster-view');
const pageTitle      = document.getElementById('page-title');
const pageSub        = document.getElementById('page-sub');
const topBarActions  = document.getElementById('top-bar-actions');

function refreshSidebarCount(teamId) {
  const item = sidebarTeamsEl.querySelector(`[data-team-nav="${teamId}"]`);
  if (!item) return;
  const count = document.querySelectorAll('[data-athlete-id]').length;
  const badge = item.querySelector('.tni-count');
  if (badge) badge.textContent = count;
}

function showTeam(team) {
  activeTeamId = team.id;

  document.querySelectorAll('.team-nav-item').forEach(el => el.classList.remove('active'));
  const navItem = sidebarTeamsEl.querySelector(`[data-team-nav="${team.id}"]`);
  if (navItem) navItem.classList.add('active');

  pageTitle.textContent = team.name;
  pageSub.textContent   = `${team.athletes.length} player${team.athletes.length !== 1 ? 's' : ''}, connect WHOOP to link a device`;

  topBarActions.innerHTML = '';
  const delTeamBtn = document.createElement('button');
  delTeamBtn.className   = 'btn btn-danger btn-sm';
  delTeamBtn.textContent = '✕ Delete team';
  delTeamBtn.onclick = async () => {
    if (!confirm(`Delete team "${team.name}" and all its players?`)) return;
    try {
      await api(`/api/teams/${team.id}`, { method: 'DELETE' });
      if (navItem) navItem.remove();
      rosterView.innerHTML = '';
      rosterView.classList.add('hidden');
      pageTitle.textContent = 'Select a team';
      pageSub.textContent   = 'Create or select a team from the sidebar';
      topBarActions.innerHTML = '';
      activeTeamId = null;
      ovEl = null;
    } catch (err) { alert(err.message); }
  };
  topBarActions.appendChild(delTeamBtn);

  rosterView.innerHTML = '';
  rosterView.classList.remove('hidden');

  // Team overview card (async)
  ovEl = document.createElement('div');
  ovEl.className = 'team-overview';
  ovEl.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Loading overview…</div>';
  rosterView.appendChild(ovEl);
  api(`/api/teams/${team.id}/overview`).then(ov => {
    ovEl.innerHTML = buildTeamOverviewHTML(ov);
    wireTeamUI();
  }).catch(() => {
    ovEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Sync players to see team overview</div>';
  });

  // Add-athlete form
  const formWrap = document.createElement('div');
  formWrap.className = 'add-athlete-form';
  formWrap.innerHTML = `
    <label>First name<input name="firstName" placeholder="e.g. Marcus" required /></label>
    <label>Last name<input name="lastName" placeholder="e.g. Rashford" required /></label>
    <label>Position<input name="role" placeholder="e.g. Left Winger" required /></label>
    <button type="button" class="btn btn-primary btn-sm" style="align-self:flex-end;margin-bottom:0" id="add-athlete-btn">+ Add Player</button>`;
  rosterView.appendChild(formWrap);

  document.getElementById('add-athlete-btn').addEventListener('click', async () => {
    const fn = formWrap.querySelector('[name=firstName]').value.trim();
    const ln = formWrap.querySelector('[name=lastName]').value.trim();
    const rl = formWrap.querySelector('[name=role]').value.trim();
    if (!fn || !ln || !rl) return alert('Please fill in all fields.');
    try {
      const athlete = await api(`/api/teams/${team.id}/athletes`, {
        method: 'POST',
        body: JSON.stringify({ firstName: fn, lastName: ln, role: rl }),
      });
      team.athletes.push(athlete);
      const frag = buildAthleteCard(team.id, athlete);
      rosterView.appendChild(frag);
      formWrap.querySelectorAll('input').forEach(i => i.value = '');
      if (navItem) {
        const badge = navItem.querySelector('.tni-count');
        if (badge) badge.textContent = team.athletes.length;
      }
      pageSub.textContent = `${team.athletes.length} player${team.athletes.length !== 1 ? 's' : ''}, connect WHOOP to link a device`;
      refreshTeamOverview();
    } catch (err) { alert(err.message); }
  });

  if (team.athletes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-data-panel';
    empty.innerHTML = '<strong>No players yet</strong><p>Add a player using the form above.</p>';
    rosterView.appendChild(empty);
  } else {
    team.athletes.forEach(a => rosterView.appendChild(buildAthleteCard(team.id, a)));
  }
}

function addTeamToSidebar(team) {
  const item = document.createElement('div');
  item.className = 'team-nav-item';
  item.dataset.teamNav = team.id;
  item.innerHTML = `<span>${team.name}</span><span class="tni-count">${team.athletes.length}</span>`;
  item.addEventListener('click', () => showTeam(team));
  sidebarTeamsEl.appendChild(item);
}

// ── Boot ─────────────────────────────────────────────────────────────
const teamForm      = document.getElementById('team-form');
const teamNameInput = document.getElementById('team-name');

teamForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = teamNameInput.value.trim();
  if (!name) return;
  try {
    const team = await api('/api/teams', { method: 'POST', body: JSON.stringify({ name }) });
    team.athletes = [];
    teamNameInput.value = '';
    addTeamToSidebar(team);
    showTeam(team);
  } catch (err) { alert(err.message); }
});

async function boot() {
  // Clear sidebar before re-populating (in case boot() called after login)
  sidebarTeamsEl.innerHTML = '';
  activeTeamId = null;
  ovEl = null;

  const teams = await api('/api/teams');
  teams.forEach(addTeamToSidebar);

  const params      = new URLSearchParams(location.search);
  const connectedId = Number(params.get('connectedAthlete'));
  if (connectedId) {
    history.replaceState({}, '', '/');
    const team = teams.find(t => t.athletes.some(a => a.id === connectedId));
    if (team) { showTeam(team); return; }
  }

  if (teams.length) showTeam(teams[0]);
  else {
    rosterView.innerHTML = `
      <div class="empty-state">
        <div class="big">${IC.bigLightning}</div>
        <h2>Welcome to Bekalo Performance Hub</h2>
        <p>Create your first team using the sidebar to get started.</p>
      </div>`;
    rosterView.classList.remove('hidden');
  }
}

// Check token on load — show auth screen or boot directly
(async () => {
  const token = getToken();
  if (token) {
    try {
      const user = await apiNoAuth('/auth/me', { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      hideAuthScreen(user);
      await boot();
    } catch {
      clearToken();
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
})();

// ── AI Chat ──────────────────────────────────────────────────────────
const chatBubble   = document.getElementById('chat-bubble');
const chatPanel    = document.getElementById('chat-panel');
const chatClose    = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSend     = document.getElementById('chat-send');
let chatHistory    = [];

chatBubble.addEventListener('click', () => chatPanel.classList.toggle('hidden'));
chatClose.addEventListener('click',  () => chatPanel.classList.add('hidden'));

function appendMsg(role, text) {
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.className = `chat-msg ${isUser ? 'user' : 'ai'}`;
  div.innerHTML = `
    <div class="chat-msg-avatar">${isUser ? 'C' : IC.brain}</div>
    <div class="chat-bubble-text">${text.replace(/</g, '&lt;')}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.id = 'chat-typing';
  div.innerHTML = `<div class="chat-msg-avatar">${IC.brain}</div>
    <div class="chat-bubble-text"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  chatSend.disabled = true;
  appendMsg('user', text);
  chatHistory.push({ role: 'user', content: text });
  showTyping();
  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text, history: chatHistory.slice(-10), teamId: activeTeamId }),
    });
    document.getElementById('chat-typing')?.remove();
    appendMsg('ai', res.reply);
    chatHistory.push({ role: 'assistant', content: res.reply });
  } catch (err) {
    document.getElementById('chat-typing')?.remove();
    appendMsg('ai', `Sorry, I couldn't reach the AI: ${err.message}`);
  } finally {
    chatSend.disabled = false;
    chatInput.focus();
  }
}

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
});

// ── WHOOP link modal ─────────────────────────────────────────────────
const whoopModal      = document.getElementById('whoop-modal');
const modalAuthLink   = document.getElementById('modal-auth-link');
const modalCodeInput  = document.getElementById('modal-code-input');
const modalSubmitBtn  = document.getElementById('modal-submit');
const modalError      = document.getElementById('modal-error');
let   modalAthleteId  = null;
let   modalOnSuccess  = null;

document.getElementById('modal-close').addEventListener('click', closeModal);
whoopModal.addEventListener('click', (e) => { if (e.target === whoopModal) closeModal(); });

function closeModal() {
  whoopModal.classList.add('hidden');
  modalCodeInput.value = '';
  modalError.classList.add('hidden');
  modalAthleteId = null;
  modalOnSuccess = null;
}

modalSubmitBtn.addEventListener('click', async () => {
  const code = modalCodeInput.value.trim();
  if (!code) { modalError.textContent = 'Please paste the authorization code.'; modalError.classList.remove('hidden'); return; }
  modalSubmitBtn.disabled = true;
  modalSubmitBtn.textContent = 'Linking…';
  modalError.classList.add('hidden');
  try {
    const res = await api(`/api/athletes/${modalAthleteId}/whoop/exchange`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (modalOnSuccess) modalOnSuccess(res.dashboard);
    closeModal();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  } finally {
    modalSubmitBtn.disabled = false;
    modalSubmitBtn.textContent = 'Link WHOOP Account';
  }
});
