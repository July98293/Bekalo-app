require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = Number(process.env.PORT || 8899);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DB_FILE = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'bekalo-dev-secret-change-in-production';

const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || '';
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || '';
const WHOOP_AUTH_URL = process.env.WHOOP_AUTH_URL || 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = process.env.WHOOP_TOKEN_URL || 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = process.env.WHOOP_API_BASE || 'https://api.prod.whoop.com/developer/v2';
const WHOOP_SCOPE = process.env.WHOOP_SCOPE || 'offline read:profile read:recovery read:sleep read:workout read:cycles read:body_measurement';
const WHOOP_REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || `${APP_BASE_URL}/auth/whoop/callback`;
const WHOOP_POSTMAN_REDIRECT = 'https://oauth.pstmn.io/v1/callback';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ── Database ────────────────────────────────────────────────────────
function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const saved = JSON.parse(raw);
    return {
      users:         saved.users         || [],
      nextUserId:    saved.nextUserId    || 1,
      teams:         saved.teams         || [],
      nextTeamId:    saved.nextTeamId    || 1,
      nextAthleteId: saved.nextAthleteId || 1,
      oauthStates:   new Map(),
    };
  } catch {
    return { users: [], nextUserId: 1, teams: [], nextTeamId: 1, nextAthleteId: 1, oauthStates: new Map() };
  }
}

function saveDb() {
  try {
    const { users, nextUserId, teams, nextTeamId, nextAthleteId } = db;
    fs.writeFileSync(DB_FILE, JSON.stringify({ users, nextUserId, teams, nextTeamId, nextAthleteId }, null, 2));
  } catch (err) {
    console.error('[DB] saveDb failed:', err.message);
  }
}

function logDbState(label) {
  console.log(`[DB] ${label} | users: ${db.users.length} | teams: ${db.teams.length}`);
}

const db = loadDb();
console.log(`[DB] Loaded from ${DB_FILE}`);
logDbState('startup');

const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Request logger ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    console.log(`[REQ] ${req.method} ${req.path}`);
  }
  next();
});

// ── Auth middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
function getTeam(teamId, userId) {
  const team = db.teams.find(t => t.id === teamId);
  if (!team) return null;
  if (userId !== undefined && team.userId !== userId) return null;
  return team;
}

function getAthlete(athleteId, userId) {
  for (const team of db.teams) {
    if (userId !== undefined && team.userId !== userId) continue;
    const athlete = team.athletes.find(a => a.id === athleteId);
    if (athlete) return { team, athlete };
  }
  return null;
}

function createStateToken(athleteId) {
  const state = `${athleteId}-${Math.random().toString(36).slice(2, 12)}`;
  db.oauthStates.set(state, { athleteId, createdAt: Date.now() });
  return state;
}

function cleanExpiredStates() {
  const now = Date.now();
  for (const [state, payload] of db.oauthStates.entries()) {
    if (now - payload.createdAt > 60 * 60 * 1000) db.oauthStates.delete(state);
  }
}

function whoopAuthUrl(athleteId) {
  const state = createStateToken(athleteId);
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    response_type: 'code',
    redirect_uri: WHOOP_REDIRECT_URI,
    scope: WHOOP_SCOPE,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    redirect_uri: WHOOP_REDIRECT_URI,
  });
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || `Token exchange failed: ${response.status}`);
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'offline',
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
  });
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || `Refresh failed: ${response.status}`);
  return data;
}

async function whoopGet(endpointPath, accessToken) {
  const response = await fetch(`${WHOOP_API_BASE}${endpointPath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${endpointPath}: ${data.message || response.statusText}`);
  return data;
}

// ── WHOOP → Dashboard transform ─────────────────────────────────────
function transformWhoopToDashboard(athlete) {
  const wd = athlete.whoopData;
  if (!wd) return null;
  const e = wd.endpoints;

  const recovery = e.recovery?.data?.records?.[0];
  const sleep    = e.sleep?.data?.records?.[0];
  const cycle    = e.cycles?.data?.records?.[0];
  const workout  = e.workout?.data?.records?.[0];
  const body     = e.bodyMeasurement?.data;

  const recoveryScore  = recovery?.score?.recovery_score   ?? null;
  const hrv            = recovery?.score?.hrv_rmssd_milli  ?? null;
  const rhr            = recovery?.score?.resting_heart_rate ?? null;
  const spo2           = recovery?.score?.spo2_percentage  ?? null;
  const skinTemp       = recovery?.score?.skin_temp_celsius ?? null;

  const sleepScore     = sleep?.score?.quality_duration_score         ?? null;
  const sleepEff       = sleep?.score?.sleep_efficiency_percentage    ?? null;
  const deepMs         = sleep?.score?.stage_summary?.total_slow_wave_sleep_time_milli ?? null;
  const remMs          = sleep?.score?.stage_summary?.total_rem_sleep_time_milli      ?? null;
  const totalSleepHrs  = (sleep?.start && sleep?.end)
    ? Math.round(((new Date(sleep.end) - new Date(sleep.start)) / 3600000) * 10) / 10
    : null;

  const dailyStrain  = cycle?.score?.strain           ?? null;
  const avgHR        = cycle?.score?.average_heart_rate ?? workout?.score?.average_heart_rate ?? null;
  const maxHR        = cycle?.score?.max_heart_rate    ?? workout?.score?.max_heart_rate    ?? null;
  const kilojoules   = cycle?.score?.kilojoule         ?? workout?.score?.kilojoule         ?? null;
  const calories     = kilojoules ? Math.round(kilojoules / 4.184) : null;
  const maxHRBpm     = body?.max_heart_rate_bpm  ?? null;
  const weight       = body?.weight_kilogram     ?? null;
  const maxHRPct     = (maxHR && maxHRBpm) ? Math.round((maxHR / maxHRBpm) * 100) : null;

  const badge = (val, cuts, labels, colors) => {
    if (val === null || val === undefined) return { label: 'N/A', color: 'gray' };
    for (let i = 0; i < cuts.length; i++) if (val >= cuts[i]) return { label: labels[i], color: colors[i] };
    return { label: labels.at(-1), color: colors.at(-1) };
  };

  const recoveryStatus = badge(recoveryScore, [67, 34], ['Optimal',   'Moderate',   'Low'],        ['green', 'yellow', 'red']);
  const sleepStatus    = badge(sleepScore,    [67, 34], ['Good',      'Sufficient',  'Poor'],       ['green', 'yellow', 'red']);
  const strainStatus   = badge(dailyStrain,   [18, 14, 8], ['Peak', 'High', 'Moderate', 'Light'],  ['red', 'orange', 'yellow', 'green']);
  const hrvStatus      = badge(hrv,           [80, 50, 30], ['Optimal', 'Good', 'Moderate', 'Critical'], ['green', 'yellow', 'orange', 'red']);
  const sprintStatus   = badge(maxHRPct,      [90, 75], ['High intensity', 'Moderate', 'Low'],      ['red', 'yellow', 'green']);

  const spo2Status = spo2 !== null
    ? (spo2 >= 95 ? { label: 'Good',      color: 'green'  }
     : spo2 >= 90 ? { label: 'Caution',   color: 'yellow' }
     :              { label: 'Critical',  color: 'red'    })
    : { label: 'N/A', color: 'gray' };

  let injuryScore = 0, injuryFactors = [];
  if (recoveryScore !== null && recoveryScore < 34) { injuryScore += 3; injuryFactors.push('Low recovery'); }
  if (hrv !== null && hrv < 30)                    { injuryScore += 3; injuryFactors.push('Critical HRV'); }
  if (dailyStrain !== null && dailyStrain > 17)    { injuryScore += 2; injuryFactors.push('Peak strain'); }
  if (sleepScore !== null && sleepScore < 34)      { injuryScore += 2; injuryFactors.push('Poor sleep'); }
  const injuryStatus = injuryScore === 0 ? { label: 'Low',  color: 'green'  }
    : injuryScore <= 3                   ? { label: 'Moderate', color: 'yellow' }
    :                                      { label: 'High', color: 'red'    };

  let mfSum = 0, mfN = 0;
  if (recoveryScore !== null) { mfSum += recoveryScore * 0.40; mfN++; }
  if (sleepScore    !== null) { mfSum += sleepScore    * 0.30; mfN++; }
  if (dailyStrain   !== null) {
    const sf = Math.max(0, Math.min(100, 100 - Math.abs(dailyStrain - 11) * 6));
    mfSum += sf * 0.30; mfN++;
  }
  const matchFitnessScore = mfN > 0 ? Math.round(mfSum) : null;
  const matchFitnessStatus = badge(matchFitnessScore, [67, 40], ['Ready', 'Moderate', 'Not Ready'], ['green', 'yellow', 'red']);

  const recommendation = (() => {
    if (recoveryScore === null) return 'Sync WHOOP to receive personalised recommendations.';
    if (recoveryScore >= 67 && (dailyStrain === null || dailyStrain <= 13)) return 'Optimal conditions — high-intensity session recommended.';
    if (recoveryScore >= 67) return 'Good recovery but high strain — consider technical or regenerative session.';
    if (recoveryScore >= 34) return 'Technical-tactical session at moderate intensity advised.';
    return 'Critical recovery — active rest or regenerative session mandatory.';
  })();

  return {
    fetchedAt: wd.fetchedAt,
    athlete:   { firstName: athlete.firstName, lastName: athlete.lastName, role: athlete.role, weight },
    matchFitness:  { score: matchFitnessScore, status: matchFitnessStatus, recommendation },
    energyRecovery:{ recoveryScore, status: recoveryStatus, calories, kilojoules: kilojoules ? Math.round(kilojoules) : null },
    stressFatigue: { dailyStrain, status: strainStatus, hrv, hrvStatus },
    heartRate:     { rhr, avgHR, maxHR, maxHRBpm, maxHRPct },
    sprintIntensity:{ maxHRPct, status: sprintStatus, maxHR, maxHRBpm },
    hydration:     { spo2, skinTemp, status: spo2Status },
    sleep:         { score: sleepScore, status: sleepStatus, efficiency: sleepEff, totalHours: totalSleepHrs, deepMinutes: deepMs ? Math.round(deepMs / 60000) : null, remMinutes: remMs ? Math.round(remMs / 60000) : null },
    injuryRisk:    { status: injuryStatus, factors: injuryFactors, score: injuryScore },
  };
}

async function fetchWhoopProfileBundle(athlete) {
  const now = Date.now();
  if (!athlete.tokens || !athlete.tokens.access_token) throw new Error('WHOOP token missing');

  if (athlete.tokens.expires_at && athlete.tokens.expires_at <= now + 30000 && athlete.tokens.refresh_token) {
    const refreshed = await refreshAccessToken(athlete.tokens.refresh_token);
    athlete.tokens = {
      ...athlete.tokens,
      ...refreshed,
      expires_at: Date.now() + (Number(refreshed.expires_in || 3600) * 1000),
      refreshed_at: new Date().toISOString(),
    };
  }

  const accessToken = athlete.tokens.access_token;
  const endpoints = [
    { key: 'profile', path: '/user/profile/basic' },
    { key: 'bodyMeasurement', path: '/user/measurement/body' },
    { key: 'cycles', path: '/cycle' },
    { key: 'recovery', path: '/recovery' },
    { key: 'sleep', path: '/activity/sleep' },
    { key: 'workout', path: '/activity/workout' },
  ];

  const results = await Promise.all(endpoints.map(async item => {
    try {
      const value = await whoopGet(item.path, accessToken);
      return [item.key, { ok: true, data: value }];
    } catch (error) {
      return [item.key, { ok: false, error: error.message }];
    }
  }));

  athlete.whoopData = {
    fetchedAt: new Date().toISOString(),
    endpoints: Object.fromEntries(results),
  };
}

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bekalo-performance-hub' });
});

// ── Auth routes ─────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const name     = String(req.body.name     || '').trim();
  const email    = String(req.body.email    || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: db.nextUserId++, email, name, passwordHash, createdAt: new Date().toISOString() };
  db.users.push(user);

  // Migrate orphan teams (no userId) to the first registered user
  if (db.users.length === 1) {
    db.teams.forEach(t => { if (!t.userId) t.userId = user.id; });
  }

  saveDb();
  logDbState(`user registered id=${user.id}`);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/auth/login', async (req, res) => {
  const email    = String(req.body.email    || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

// ── Team routes ─────────────────────────────────────────────────────
app.get('/api/teams', requireAuth, (req, res) => {
  res.json(db.teams.filter(t => t.userId === req.user.id));
});

app.post('/api/teams', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name required' });
  const team = { id: db.nextTeamId++, userId: req.user.id, name, athletes: [] };
  db.teams.push(team);
  saveDb();
  logDbState(`team created id=${team.id}`);
  res.status(201).json(team);
});

app.delete('/api/teams/:teamId', requireAuth, (req, res) => {
  const teamId = Number(req.params.teamId);
  const idx = db.teams.findIndex(t => t.id === teamId && t.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Team not found' });
  db.teams.splice(idx, 1);
  saveDb();
  logDbState(`team deleted id=${teamId}`);
  res.json({ ok: true });
});

// ── Athlete routes ───────────────────────────────────────────────────
app.post('/api/teams/:teamId/athletes', requireAuth, (req, res) => {
  const teamId = Number(req.params.teamId);
  const team = getTeam(teamId, req.user.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const firstName = String(req.body.firstName || '').trim();
  const lastName  = String(req.body.lastName  || '').trim();
  const role      = String(req.body.role      || '').trim();
  if (!firstName || !lastName || !role) return res.status(400).json({ error: 'firstName, lastName, role are required' });

  const athlete = { id: db.nextAthleteId++, firstName, lastName, role, whoopConnected: false, tokens: null, whoopData: null, createdAt: new Date().toISOString() };
  team.athletes.push(athlete);
  saveDb();
  logDbState(`athlete created id=${athlete.id} team=${teamId}`);
  res.status(201).json({ ...athlete, whoopAuthUrl: whoopAuthUrl(athlete.id) });
});

app.delete('/api/athletes/:athleteId', requireAuth, (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  result.team.athletes = result.team.athletes.filter(a => a.id !== athleteId);
  saveDb();
  logDbState(`athlete deleted id=${athleteId}`);
  res.json({ ok: true });
});

app.get('/api/athletes/:athleteId/dashboard', requireAuth, (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const dashboard = transformWhoopToDashboard(result.athlete);
  if (!dashboard) return res.json({ noData: true, whoopConnected: result.athlete.whoopConnected });
  res.json(dashboard);
});

app.post('/api/athletes/:athleteId/whoop/sync', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  if (!athlete.whoopConnected) return res.status(400).json({ error: 'WHOOP not connected' });
  try {
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/athletes/:athleteId/whoop/auth-url', requireAuth, (req, res) => {
  cleanExpiredStates();
  const athleteId = Number(req.params.athleteId);
  if (!getAthlete(athleteId, req.user.id)) return res.status(404).json({ error: 'Athlete not found' });
  const state = createStateToken(athleteId);
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID, response_type: 'code',
    redirect_uri: WHOOP_POSTMAN_REDIRECT, scope: WHOOP_SCOPE, state,
  });
  res.json({ url: `${WHOOP_AUTH_URL}?${params.toString()}`, state });
});

app.post('/api/athletes/:athleteId/whoop/exchange', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'code is required' });

  const body = new URLSearchParams({
    grant_type: 'authorization_code', code,
    client_id: WHOOP_CLIENT_ID, client_secret: WHOOP_CLIENT_SECRET,
    redirect_uri: WHOOP_POSTMAN_REDIRECT,
  });
  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const tokenData = await response.json();
    if (!response.ok) throw new Error(tokenData.error_description || tokenData.error || `Token exchange failed: ${response.status}`);
    athlete.tokens = { ...tokenData, expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000), connected_at: new Date().toISOString() };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WHOOP OAuth redirect (browser flow — no JWT needed) ─────────────
app.get('/auth/whoop/login', (req, res) => {
  cleanExpiredStates();
  if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) return res.status(500).send('Missing WHOOP credentials in .env');
  const athleteId = Number(req.query.athleteId);
  if (!athleteId || !getAthlete(athleteId)) return res.status(400).send('athleteId required');
  res.redirect(whoopAuthUrl(athleteId));
});

app.get('/auth/whoop/callback', async (req, res) => {
  cleanExpiredStates();
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const oauthError = String(req.query.error || '');

  if (oauthError) return res.status(400).send(`WHOOP OAuth error: ${oauthError}. Go back and click "Connect WHOOP" again.`);

  const statePayload = db.oauthStates.get(state);
  db.oauthStates.delete(state);
  if (!code || !statePayload) return res.status(400).send('Invalid OAuth callback. Go back and reconnect.');

  const result = getAthlete(Number(statePayload.athleteId));
  if (!result) return res.status(404).send('Athlete not found');
  const { athlete } = result;

  try {
    const tokenData = await exchangeCodeForToken(code);
    athlete.tokens = { ...tokenData, expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000), connected_at: new Date().toISOString() };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.redirect(`/?connectedAthlete=${athlete.id}`);
  } catch (error) {
    res.status(500).send(`WHOOP OAuth error: ${error.message}`);
  }
});

// ── Team overview ────────────────────────────────────────────────────
app.get('/api/teams/:teamId/overview', requireAuth, (req, res) => {
  const teamId = Number(req.params.teamId);
  const team   = getTeam(teamId, req.user.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const withData = team.athletes
    .filter(a => a.whoopData)
    .map(a => ({ athlete: a, d: transformWhoopToDashboard(a) }))
    .filter(({ d }) => d !== null);

  const numVals = (key, sub) =>
    withData.map(({ d }) => d[key]?.[sub]).filter(v => v !== null && v !== undefined && !isNaN(v));

  const avg = (key, sub) => {
    const v = numVals(key, sub);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  const mfScores = withData.map(({ d }) => d.matchFitness.score).filter(v => v !== null);
  const teamFitness = mfScores.length ? Math.round(mfScores.reduce((a, b) => a + b, 0) / mfScores.length) : null;

  const statusColor = teamFitness === null ? 'gray' : teamFitness >= 67 ? 'green' : teamFitness >= 40 ? 'yellow' : 'red';
  const statusLabel = teamFitness === null ? 'No Data' : teamFitness >= 67 ? 'Ready' : teamFitness >= 40 ? 'Moderate' : 'Low';

  const avgHrvRaw = withData.map(({ d }) => d.stressFatigue.hrv).filter(v => v !== null && v !== undefined);
  const avgHrv = avgHrvRaw.length ? Math.round(avgHrvRaw.reduce((a, b) => a + b, 0) / avgHrvRaw.length * 10) / 10 : null;

  const avgSprintRaw = withData.map(({ d }) => d.sprintIntensity.maxHRPct).filter(v => v !== null && v !== undefined);
  const avgSprintPct = avgSprintRaw.length ? Math.round(avgSprintRaw.reduce((a, b) => a + b, 0) / avgSprintRaw.length) : null;

  const readyCount    = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score >= 67).length;
  const moderateCount = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score >= 40 && d.matchFitness.score < 67).length;
  const lowCount      = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score < 40).length;
  const readinessPct  = withData.length > 0 ? Math.round(readyCount / withData.length * 100) : null;

  const highStrainCount = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain >= 14).length;
  const modStrainCount  = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain >= 7 && d.stressFatigue.dailyStrain < 14).length;
  const lightStrainCount = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain < 7).length;

  const goodHrvCount = withData.filter(({ d }) => d.stressFatigue.hrv !== null && d.stressFatigue.hrv >= 50).length;

  const atRisk = withData
    .filter(({ d }) => d.injuryRisk.status.color === 'red')
    .map(({ athlete, d }) => ({ name: `${athlete.firstName} ${athlete.lastName}`, factors: d.injuryRisk.factors }));

  // Full player list (synced + unsynced) for snapshot table
  const allPlayers = team.athletes.map(athlete => {
    const wd = withData.find(w => w.athlete.id === athlete.id);
    if (wd) {
      const d = wd.d;
      return {
        name:         `${athlete.firstName} ${athlete.lastName}`,
        role:         athlete.role,
        synced:       true,
        matchFitness: d.matchFitness.score,
        statusColor:  d.matchFitness.status.color,
        statusLabel:  d.matchFitness.status.label,
        recovery:     d.energyRecovery.recoveryScore,
        sleep:        d.sleep.score,
        strain:       d.stressFatigue.dailyStrain !== null ? parseFloat(d.stressFatigue.dailyStrain.toFixed(1)) : null,
        hrv:          d.stressFatigue.hrv !== null ? Math.round(d.stressFatigue.hrv) : null,
        sprintPct:    d.sprintIntensity.maxHRPct,
        injuryColor:  d.injuryRisk.status.color,
      };
    }
    return {
      name: `${athlete.firstName} ${athlete.lastName}`,
      role: athlete.role,
      synced: false,
      matchFitness: null, statusColor: 'gray', statusLabel: 'No Data',
      recovery: null, sleep: null, strain: null, hrv: null, sprintPct: null, injuryColor: 'gray',
    };
  });

  res.json({
    teamName:       team.name,
    totalPlayers:   team.athletes.length,
    syncedPlayers:  withData.length,
    teamFitness, statusColor, statusLabel,
    avgRecovery:    avg('energyRecovery', 'recoveryScore'),
    avgSleep:       avg('sleep', 'score'),
    avgStrain:      (() => { const v = numVals('stressFatigue', 'dailyStrain'); return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : null; })(),
    avgHrv, avgSprintPct,
    readyCount, moderateCount, lowCount, readinessPct,
    highStrainCount, modStrainCount, lightStrainCount,
    goodHrvCount,
    atRisk, allPlayers,
  });
});

// ── AI Chat ─────────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  const { message, history = [], teamId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  let playerContext = '';
  if (teamId) {
    const team = db.teams.find(t => t.id === Number(teamId) && t.userId === req.user.id);
    if (team) {
      playerContext = `\n\nCurrent team: "${team.name}"\nPlayers:\n`;
      for (const athlete of team.athletes) {
        playerContext += `\n${athlete.firstName} ${athlete.lastName} (${athlete.role})`;
        if (athlete.whoopData) {
          const d = transformWhoopToDashboard(athlete);
          if (d) {
            playerContext += `. Match Fitness: ${d.matchFitness.score ?? 'N/A'}/100 (${d.matchFitness.status.label}), Recovery: ${d.energyRecovery.recoveryScore ?? 'N/A'}/100, Strain: ${d.stressFatigue.dailyStrain ?? 'N/A'}/21, HRV: ${d.stressFatigue.hrv ? d.stressFatigue.hrv.toFixed(1) + ' ms' : 'N/A'}, Resting HR: ${d.heartRate.rhr ? d.heartRate.rhr + ' bpm' : 'N/A'}, Sleep: ${d.sleep.score ?? 'N/A'}/100 (${d.sleep.totalHours ? d.sleep.totalHours + 'h' : 'N/A'}), Injury Risk: ${d.injuryRisk.status.label}${d.injuryRisk.factors.length ? ', risk factors: ' + d.injuryRisk.factors.join(', ') : ''}.`;
          }
        } else {
          playerContext += ', no WHOOP data';
        }
      }
    }
  }

  const systemPrompt = `You are Bekalo AI Coach, an expert football performance analyst embedded in Bekalo Performance Hub. Analyse WHOOP biometric data for professional football players and give concise, actionable insights to coaches. Direct, professional, evidence-based. Use football terminology. Under 200 words unless asked for detail. Reply in the same language the coach writes in.${playerContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.7 }),
    });
    const data = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(data.error?.message || `OpenAI ${openaiRes.status}`);
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Weather (Open-Meteo, free, no key) ───────────────────────────────
function wmoCodeToLabel(code) {
  if (code === 0)              return 'Clear sky';
  if (code <= 3)               return 'Partly cloudy';
  if (code <= 49)              return 'Foggy';
  if (code <= 59)              return 'Drizzle';
  if (code <= 69)              return 'Rain';
  if (code <= 79)              return 'Snow';
  if (code <= 84)              return 'Rain showers';
  if (code <= 99)              return 'Thunderstorm';
  return 'Unknown';
}
function wmoCodeToEmoji(code) {
  if (code === 0)              return '☀️';
  if (code <= 3)               return '⛅';
  if (code <= 49)              return '🌫️';
  if (code <= 59)              return '🌦️';
  if (code <= 69)              return '🌧️';
  if (code <= 79)              return '❄️';
  if (code <= 84)              return '🌦️';
  if (code <= 99)              return '⛈️';
  return '🌡️';
}

app.get('/api/weather', requireAuth, async (req, res) => {
  const location = String(req.query.location || '').trim();
  const date     = String(req.query.date     || '').trim();
  if (!location || !date) return res.status(400).json({ error: 'location and date required' });

  try {
    // 1. Geocode
    const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return res.status(404).json({ error: `Location not found: "${location}"` });

    const { latitude, longitude, name, country } = geoData.results[0];

    // 2. Check date window (Open-Meteo forecasts up to 16 days)
    const matchDate = new Date(date);
    const daysAhead = (matchDate - Date.now()) / 86400000;
    if (daysAhead < -1) return res.json({ available: false, reason: 'past',     locationName: `${name}, ${country}` });
    if (daysAhead > 16) return res.json({ available: false, reason: 'too_far',  locationName: `${name}, ${country}` });

    // 3. Fetch hourly forecast for that day
    const dateStr = matchDate.toISOString().split('T')[0];
    const fRes    = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m` +
      `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`
    );
    const fData = await fRes.json();
    if (!fData.hourly) throw new Error('No forecast data returned');

    const hour = Math.min(matchDate.getHours(), fData.hourly.time.length - 1);
    const code = fData.hourly.weathercode[hour];

    res.json({
      available: true,
      locationName: `${name}, ${country}`,
      temperature:  Math.round(fData.hourly.temperature_2m[hour]),
      precipitation: fData.hourly.precipitation_probability[hour] ?? 0,
      windspeed:    Math.round(fData.hourly.windspeed_10m[hour]),
      condition:    wmoCodeToLabel(code),
      emoji:        wmoCodeToEmoji(code),
    });
  } catch (err) {
    console.error('[WEATHER]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SPA fallback ─────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const HOST = IS_PROD ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[SERVER] Bekalo running on ${HOST}:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  console.log(`[SERVER] APP_BASE_URL = ${APP_BASE_URL}`);
  console.log(`[SERVER] WHOOP redirect URI = ${WHOOP_REDIRECT_URI}`);
  console.log(`[SERVER] DB file = ${DB_FILE}`);
});
