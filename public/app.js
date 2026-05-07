// ── WHOOP Link Modal ────────────────────────────────────────────────
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

async function openWhoopModal(athleteId, onSuccess) {
  modalAthleteId = athleteId;
  modalOnSuccess = onSuccess;
  whoopModal.classList.remove('hidden');
  modalError.classList.add('hidden');

  // Disable link until real WHOOP URL is ready
  modalAuthLink.removeAttribute('href');
  modalAuthLink.style.pointerEvents = 'none';
  modalAuthLink.style.opacity = '0.5';
  modalAuthLink.textContent = 'Generating link…';

  try {
    const { url } = await api(`/api/athletes/${athleteId}/whoop/auth-url`);
    modalAuthLink.href = url;
    modalAuthLink.style.pointerEvents = '';
    modalAuthLink.style.opacity = '';
    modalAuthLink.textContent = 'Open WHOOP Authorization →';
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  }
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

// ── API helper ─────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res  = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data;
}

// ── Formatting helpers ──────────────────────────────────────────────
const fmt = (v, unit = '', na = 'N/A') =>
  (v === null || v === undefined) ? na : `${v}${unit ? ' ' + unit : ''}`;

function sbadge(color, label) {
  return `<span class="sbadge ${color}">${label}</span>`;
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

// ── Ring gauge ──────────────────────────────────────────────────────
function ringHtml(score, color) {
  const r    = 40;
  const circ = 2 * Math.PI * r;
  const pct  = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const off  = circ - pct * circ;
  return `
    <div class="ring-wrap">
      <svg viewBox="0 0 96 96">
        <circle class="ring-track" cx="48" cy="48" r="${r}"/>
        <circle class="ring-fill ${color}" cx="48" cy="48" r="${r}"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
      </svg>
      <div class="ring-label">
        <span class="ring-score">${score ?? '–'}</span>
        <span class="ring-denom">/ 100</span>
      </div>
    </div>`;
}

// ── Metric card ─────────────────────────────────────────────────────
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

// ── Dashboard renderer ──────────────────────────────────────────────
function renderDashboard(d) {
  if (!d || d.noData) {
    return `<div class="no-data-panel">
      <strong>${d && !d.whoopConnected ? 'WHOOP not connected' : 'No data yet'}</strong>
      <p>${d && !d.whoopConnected
        ? 'Click "Connect WHOOP" to link this athlete\'s device.'
        : 'Click "↻ Sync" to fetch the latest data from WHOOP.'}</p>
    </div>`;
  }

  const { matchFitness: mf, energyRecovery: er, stressFatigue: sf,
          heartRate: hr, sprintIntensity: sp, hydration: hy, sleep: sl, injuryRisk: ir } = d;

  const ts = d.fetchedAt ? new Date(d.fetchedAt).toLocaleString('en-GB') : '';

  const hero = `
    <div class="hero-card">
      ${ringHtml(mf.score, mf.status.color)}
      <div class="hero-body">
        <div class="hero-label-sm">Match Fitness Score</div>
        <div class="hero-status" style="color:var(--${mf.status.color})">${mf.status.label}</div>
        <div class="hero-rec">📋 ${mf.recommendation}</div>
      </div>
    </div>`;

  const efPct = sl.efficiency !== null ? sl.efficiency.toFixed(0) : null;
  const sleepBarWidth = efPct !== null ? `${Math.min(100, efPct)}%` : '0%';

  const sleepCard = `
    <div class="m-card">
      <div class="m-card-head">
        <span class="m-card-title">Sleep & Recovery Quality</span>
        <span class="m-card-icon">🌙</span>
      </div>
      <div class="m-main">
        <span class="m-val">${fmt(sl.score)}</span>
        <span class="m-unit">/ 100</span>
      </div>
      ${sbadge(sl.status.color, sl.status.label)}
      <div class="m-rows">
        <div class="m-row"><span class="l">Total duration</span><span class="v">${sl.totalHours !== null ? sl.totalHours + 'h' : 'N/A'}</span></div>
        <div class="m-row"><span class="l">Deep sleep</span><span class="v">${sl.deepMinutes !== null ? sl.deepMinutes + ' min' : 'N/A'}</span></div>
        <div class="m-row"><span class="l">REM sleep</span><span class="v">${sl.remMinutes !== null ? sl.remMinutes + ' min' : 'N/A'}</span></div>
      </div>
      ${efPct !== null ? `
        <div class="sleep-bar-wrap">
          <div class="m-row" style="margin-bottom:4px"><span class="l">Efficiency</span><span class="v">${efPct}%</span></div>
          <div class="sleep-bar-bg"><div class="sleep-bar-fill" style="width:${sleepBarWidth}"></div></div>
        </div>` : ''}
    </div>`;

  const injuryCard = `
    <div class="m-card">
      <div class="m-card-head">
        <span class="m-card-title">Injury Risk Indicators</span>
        <span class="m-card-icon">🛡️</span>
      </div>
      <div class="m-main"><span class="m-val">${ir.status.label}</span></div>
      ${sbadge(ir.status.color, ir.factors.length === 0 ? 'No critical factors' : `${ir.factors.length} risk factor${ir.factors.length > 1 ? 's' : ''} detected`)}
      ${ir.factors.length ? `<div class="factor-list">${ir.factors.map(f => `<span class="factor-pill">${f}</span>`).join('')}</div>` : ''}
    </div>`;

  const cards = [
    mCard('⚡', 'Energy & Recovery', fmt(er.recoveryScore), '/100', er.status, [
      ['Calories burned', fmt(er.calories, 'kcal')],
      ['Total energy',    fmt(er.kilojoules, 'kJ')],
    ]),
    mCard('🔥', 'Stress & Fatigue', sf.dailyStrain !== null ? sf.dailyStrain.toFixed(1) : 'N/A', '/ 21', sf.status, [
      ['Daily strain', fmt(sf.dailyStrain !== null ? sf.dailyStrain.toFixed(1) : null, '/ 21')],
      ['HRV',          fmt(sf.hrv !== null ? sf.hrv.toFixed(1) : null, 'ms')],
      ['HRV status',   sf.hrvStatus ? sbadge(sf.hrvStatus.color, sf.hrvStatus.label) : 'N/A'],
    ]),
    mCard('❤️', 'Heart Rate & CV Load', fmt(hr.rhr, 'bpm'), '', null, [
      ['Resting HR (RHR)',  fmt(hr.rhr, 'bpm')],
      ['Average HR',       fmt(hr.avgHR, 'bpm')],
      ['Peak HR (session)',fmt(hr.maxHR, 'bpm')],
      ['Max HR (theoretical)', fmt(hr.maxHRBpm, 'bpm')],
    ]),
    mCard('💨', 'Sprint Intensity', sp.maxHRPct !== null ? `${sp.maxHRPct}%` : 'N/A', 'of max HR', sp.status, [
      ['Peak HR',          fmt(sp.maxHR, 'bpm')],
      ['Max HR (theory)',  fmt(sp.maxHRBpm, 'bpm')],
      ['% Max HR reached', sp.maxHRPct !== null ? `${sp.maxHRPct}%` : 'N/A'],
    ]),
    mCard('🎯', 'Training Readiness', fmt(er.recoveryScore), '/100', er.status, [
      ['WHOOP Recovery', fmt(er.recoveryScore, '/100')],
      ['HRV',           fmt(sf.hrv !== null ? sf.hrv.toFixed(1) : null, 'ms')],
      ['Resting HR',    fmt(hr.rhr, 'bpm')],
    ]),
    mCard('💧', 'Hydration Status', hy.spo2 !== null ? `${hy.spo2.toFixed(1)}%` : 'N/A', 'SpO₂', hy.status, [
      ['Blood oxygen (SpO₂)', hy.spo2 !== null ? `${hy.spo2.toFixed(1)}%` : 'N/A'],
      ['Skin temperature',    hy.skinTemp !== null ? `${hy.skinTemp.toFixed(1)} °C` : 'N/A'],
    ]),
    sleepCard,
    injuryCard,
  ];

  return `
    ${hero}
    <div class="metrics-grid">${cards.join('')}</div>
    ${ts ? `<p class="sync-info">Last synced: ${ts}</p>` : ''}`;
}

// ── Update quick stats bar ──────────────────────────────────────────
function updateQuickStats(cardEl, d) {
  const bar = cardEl.querySelector('.ac-quick');
  if (!d || d.noData) { bar.classList.add('hidden'); return; }

  const { matchFitness: mf, energyRecovery: er, sleep: sl, stressFatigue: sf, heartRate: hr } = d;

  bar.querySelector('.fitness-val').textContent  = mf.score !== null  ? mf.score  : '—';
  bar.querySelector('.recovery-val').textContent = er.recoveryScore !== null ? er.recoveryScore : '—';
  bar.querySelector('.sleep-val').textContent    = sl.score !== null  ? sl.score  : '—';
  bar.querySelector('.strain-val').textContent   = sf.dailyStrain !== null ? sf.dailyStrain.toFixed(1) : '—';
  bar.querySelector('.rhr-val').textContent      = hr.rhr !== null    ? `${hr.rhr} bpm` : '—';

  const rb = bar.querySelector('.readiness-badge');
  rb.textContent = mf.status.label;
  const colorMap = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)', gray: 'var(--text3)' };
  rb.style.color       = colorMap[mf.status.color] || colorMap.gray;
  rb.style.borderColor = colorMap[mf.status.color] || colorMap.gray;
  rb.style.background  = `${colorMap[mf.status.color] || colorMap.gray}18`;

  bar.classList.remove('hidden');
}

// ── Athlete card ────────────────────────────────────────────────────
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
    whoopPill.textContent = on ? '● WHOOP' : 'WHOOP';
    whoopPill.className   = `whoop-pill ${on ? 'connected' : 'disconnected'}`;
    connectBtn.textContent= on ? 'Reconnect' : 'Connect WHOOP';
  }
  setConnected(athlete.whoopConnected);

  // Direct OAuth flow — redirect URI http://localhost:8899/auth/whoop/callback is registered
  connectBtn.href   = `/auth/whoop/login?athleteId=${athlete.id}`;
  connectBtn.target = '_self';

  async function loadDashboard() {
    try {
      const d = await api(`/api/athletes/${athlete.id}/dashboard`);
      dashEl.innerHTML = renderDashboard(d);
      updateQuickStats(card, d);
    } catch {
      dashEl.innerHTML = `<div class="no-data-panel"><strong>Failed to load data</strong></div>`;
    }
  }

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled    = true;
    syncBtn.textContent = '↻ Syncing…';
    try {
      const res = await api(`/api/athletes/${athlete.id}/whoop/sync`, { method: 'POST' });
      setConnected(true);
      dashEl.innerHTML = renderDashboard(res.dashboard);
      updateQuickStats(card, res.dashboard);
    } catch (err) { alert(err.message); }
    finally {
      syncBtn.disabled    = false;
      syncBtn.textContent = '↻ Sync';
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Remove ${athlete.firstName} ${athlete.lastName} from the roster?`)) return;
    deleteBtn.disabled = true;
    try {
      await api(`/api/athletes/${athlete.id}`, { method: 'DELETE' });
      // Remove directly from DOM — no full reload needed
      const el = document.querySelector(`[data-athlete-id="${athlete.id}"]`);
      if (el) el.remove();
      refreshSidebarCount(teamId);
    } catch (err) {
      alert(err.message);
      deleteBtn.disabled = false;
    }
  });

  loadDashboard();
  return frag;
}

// ── Sidebar ─────────────────────────────────────────────────────────
let activeTeamId = null;
const sidebarTeamsEl = document.getElementById('sidebar-teams');
const rosterView     = document.getElementById('roster-view');
const pageTitle      = document.getElementById('page-title');
const pageSub        = document.getElementById('page-sub');
const topBarActions  = document.getElementById('top-bar-actions');

function refreshSidebarCount(teamId) {
  const item = sidebarTeamsEl.querySelector(`[data-team-nav="${teamId}"]`);
  if (!item) return;
  const count = document.querySelectorAll(`[data-athlete-id]`).length;
  const badge = item.querySelector('.tni-count');
  if (badge) badge.textContent = count;
}

function showTeam(team) {
  activeTeamId = team.id;

  // Update sidebar active state
  document.querySelectorAll('.team-nav-item').forEach(el => el.classList.remove('active'));
  const navItem = sidebarTeamsEl.querySelector(`[data-team-nav="${team.id}"]`);
  if (navItem) navItem.classList.add('active');

  pageTitle.textContent = team.name;
  pageSub.textContent   = `${team.athletes.length} player${team.athletes.length !== 1 ? 's' : ''} · Click "Connect WHOOP" on any player to link their device`;

  // Delete team button in top bar
  topBarActions.innerHTML = '';
  const delTeamBtn = document.createElement('button');
  delTeamBtn.className   = 'btn btn-danger btn-sm';
  delTeamBtn.textContent = '✕ Delete team';
  delTeamBtn.onclick = async () => {
    if (!confirm(`Delete team "${team.name}" and all its players?`)) return;
    try {
      await api(`/api/teams/${team.id}`, { method: 'DELETE' });
      // Remove from sidebar and clear view
      if (navItem) navItem.remove();
      rosterView.innerHTML = '';
      rosterView.classList.add('hidden');
      pageTitle.textContent = 'Select a team';
      pageSub.textContent   = 'Create or select a team from the sidebar';
      topBarActions.innerHTML = '';
      activeTeamId = null;
    } catch (err) { alert(err.message); }
  };
  topBarActions.appendChild(delTeamBtn);

  // Build roster
  rosterView.innerHTML = '';
  rosterView.classList.remove('hidden');

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
      // Update sidebar count
      if (navItem) {
        const badge = navItem.querySelector('.tni-count');
        if (badge) badge.textContent = team.athletes.length;
      }
      pageSub.textContent = `${team.athletes.length} player${team.athletes.length !== 1 ? 's' : ''} · Click "Connect WHOOP" on any player to link their device`;
    } catch (err) { alert(err.message); }
  });

  // Render existing athletes
  if (team.athletes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-data-panel';
    empty.innerHTML = '<strong>No players yet</strong><p>Add a player using the form above.</p>';
    rosterView.appendChild(empty);
  } else {
    team.athletes.forEach(a => {
      const frag = buildAthleteCard(team.id, a);
      rosterView.appendChild(frag);
    });
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

// ── Boot ────────────────────────────────────────────────────────────
const teamForm     = document.getElementById('team-form');
const teamNameInput= document.getElementById('team-name');

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
  const teams = await api('/api/teams');
  teams.forEach(addTeamToSidebar);

  // Auto-open if returned from OAuth redirect
  const params      = new URLSearchParams(location.search);
  const connectedId = Number(params.get('connectedAthlete'));
  if (connectedId) {
    history.replaceState({}, '', '/');
    // Find which team has that athlete and open it
    const team = teams.find(t => t.athletes.some(a => a.id === connectedId));
    if (team) { showTeam(team); return; }
  }

  // Default: open first team
  if (teams.length) showTeam(teams[0]);
  else {
    rosterView.innerHTML = `
      <div class="empty-state">
        <div class="big">⚡</div>
        <h2>Welcome to Bekalo Performance Hub</h2>
        <p>Create your first team using the sidebar to get started.</p>
      </div>`;
    rosterView.classList.remove('hidden');
  }
}

boot().catch(err => console.error(err));

// ── AI Chat ─────────────────────────────────────────────────────────
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
    <div class="chat-msg-avatar">${isUser ? 'C' : '🧠'}</div>
    <div class="chat-bubble-text">${text.replace(/</g, '&lt;')}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.id = 'chat-typing';
  div.innerHTML = `<div class="chat-msg-avatar">🧠</div>
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
// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
});
