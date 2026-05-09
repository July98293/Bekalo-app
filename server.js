require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('./db');

const app         = express();
const PORT        = Number(process.env.PORT || 8899);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const JWT_SECRET  = process.env.JWT_SECRET || 'bekalo-dev-secret-change-in-production';

const WHOOP_CLIENT_ID     = process.env.WHOOP_CLIENT_ID     || '';
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || '';
const WHOOP_AUTH_URL      = process.env.WHOOP_AUTH_URL      || 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL     = process.env.WHOOP_TOKEN_URL     || 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE      = process.env.WHOOP_API_BASE      || 'https://api.prod.whoop.com/developer/v2';
const WHOOP_SCOPE         = process.env.WHOOP_SCOPE         || 'offline read:profile read:recovery read:sleep read:workout read:cycles read:body_measurement';
const WHOOP_REDIRECT_URI  = process.env.WHOOP_REDIRECT_URI  || `${APP_BASE_URL}/auth/whoop/callback`;
const WHOOP_POSTMAN_REDIRECT = 'https://oauth.pstmn.io/v1/callback';
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY   || '';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const FOOTBALL_API_BASE = (process.env.FOOTBALL_API_URL || 'https://api.football-data.org/v4/matches')
  .replace(/\/matches.*$/, '');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Superadmin — only this email can ever have admin role ────────────
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'giulia.sironi.02@gmail.com').toLowerCase();

// ── In-memory OAuth state store (short-lived, cleared on restart) ────
const oauthStates = new Map();

// ── Run migrations on startup ────────────────────────────────────────
async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_create_schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[DB] Migrations applied');

  // Ensure the superadmin email always has admin role
  await pool.query(
    "UPDATE bekalo_users SET role = 'admin' WHERE email = $1 AND role != 'admin'",
    [SUPERADMIN_EMAIL]
  );
}

// ── DB row → JS object mappers ───────────────────────────────────────
function mapAthleteRow(row) {
  return {
    id:             row.id,
    firstName:      row.first_name,
    lastName:       row.last_name,
    role:           row.position,
    whoopConnected: row.whoop_connected,
    notes:          row.notes || '',
    tokens:         row.tokens,
    whoopData:      row.whoop_data,
    labResults:     [],
    createdAt:      row.created_at,
  };
}

async function getTeam(teamId, userId) {
  const params = [teamId];
  let sql = 'SELECT * FROM teams WHERE id = $1';
  if (userId !== undefined) { sql += ' AND user_id = $2'; params.push(userId); }
  const { rows } = await pool.query(sql, params);
  return rows[0] ? { id: rows[0].id, userId: rows[0].user_id, name: rows[0].name } : null;
}

async function getAthlete(athleteId, userId) {
  const params = [athleteId];
  let sql = `
    SELECT a.*, t.user_id AS team_user_id, t.id AS t_id, t.name AS t_name
    FROM athletes a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = $1`;
  if (userId !== undefined) { sql += ' AND t.user_id = $2'; params.push(userId); }
  const { rows } = await pool.query(sql, params);
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    team: { id: row.t_id, userId: row.team_user_id, name: row.t_name },
    athlete: mapAthleteRow(row),
  };
}

// ── Express setup ────────────────────────────────────────────────────
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    console.log(`[REQ] ${req.method} ${req.path}`);
  }
  next();
});

// ── Auth middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT email, role FROM bekalo_users WHERE id = $1', [req.user.id]);
    if (!rows[0] || rows[0].email !== SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// ── WHOOP OAuth helpers ──────────────────────────────────────────────
function createStateToken(athleteId) {
  const state = `${athleteId}-${Math.random().toString(36).slice(2, 12)}`;
  oauthStates.set(state, { athleteId, createdAt: Date.now() });
  return state;
}

function cleanExpiredStates() {
  const now = Date.now();
  for (const [state, payload] of oauthStates.entries()) {
    if (now - payload.createdAt > 60 * 60 * 1000) oauthStates.delete(state);
  }
}

function whoopAuthUrl(athleteId) {
  const state  = createStateToken(athleteId);
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID, response_type: 'code',
    redirect_uri: WHOOP_REDIRECT_URI, scope: WHOOP_SCOPE, state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code,
    client_id: WHOOP_CLIENT_ID, client_secret: WHOOP_CLIENT_SECRET,
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
    grant_type: 'refresh_token', refresh_token: refreshToken,
    scope: 'offline', client_id: WHOOP_CLIENT_ID, client_secret: WHOOP_CLIENT_SECRET,
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

  const recoveryScore = recovery?.score?.recovery_score   ?? null;
  const hrv           = recovery?.score?.hrv_rmssd_milli  ?? null;
  const rhr           = recovery?.score?.resting_heart_rate ?? null;
  const spo2          = recovery?.score?.spo2_percentage  ?? null;
  const skinTemp      = recovery?.score?.skin_temp_celsius ?? null;

  const sleepScore    = sleep?.score?.quality_duration_score         ?? null;
  const sleepEff      = sleep?.score?.sleep_efficiency_percentage    ?? null;
  const deepMs        = sleep?.score?.stage_summary?.total_slow_wave_sleep_time_milli ?? null;
  const remMs         = sleep?.score?.stage_summary?.total_rem_sleep_time_milli      ?? null;
  const totalSleepHrs = (sleep?.start && sleep?.end)
    ? Math.round(((new Date(sleep.end) - new Date(sleep.start)) / 3600000) * 10) / 10
    : null;

  const dailyStrain = cycle?.score?.strain             ?? null;
  const avgHR       = cycle?.score?.average_heart_rate ?? workout?.score?.average_heart_rate ?? null;
  const maxHR       = cycle?.score?.max_heart_rate     ?? workout?.score?.max_heart_rate     ?? null;
  const kilojoules  = cycle?.score?.kilojoule          ?? workout?.score?.kilojoule          ?? null;
  const calories    = kilojoules ? Math.round(kilojoules / 4.184) : null;
  const maxHRBpm    = body?.max_heart_rate_bpm ?? null;
  const weight      = body?.weight_kilogram    ?? null;
  const maxHRPct    = (maxHR && maxHRBpm) ? Math.round((maxHR / maxHRBpm) * 100) : null;

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
    ? (spo2 >= 95 ? { label: 'Good',     color: 'green'  }
     : spo2 >= 90 ? { label: 'Caution',  color: 'yellow' }
     :              { label: 'Critical', color: 'red'    })
    : { label: 'N/A', color: 'gray' };

  let injuryScore = 0, injuryFactors = [];
  if (recoveryScore !== null && recoveryScore < 34) { injuryScore += 3; injuryFactors.push('Low recovery'); }
  if (hrv !== null && hrv < 30)                    { injuryScore += 3; injuryFactors.push('Critical HRV'); }
  if (dailyStrain !== null && dailyStrain > 17)    { injuryScore += 2; injuryFactors.push('Peak strain'); }
  if (sleepScore !== null && sleepScore < 34)      { injuryScore += 2; injuryFactors.push('Poor sleep'); }
  const injuryStatus = injuryScore === 0 ? { label: 'Low',      color: 'green'  }
    : injuryScore <= 3                   ? { label: 'Moderate', color: 'yellow' }
    :                                      { label: 'High',     color: 'red'    };

  let mfSum = 0, mfN = 0;
  if (recoveryScore !== null) { mfSum += recoveryScore * 0.40; mfN++; }
  if (sleepScore    !== null) { mfSum += sleepScore    * 0.30; mfN++; }
  if (dailyStrain   !== null) {
    const sf = Math.max(0, Math.min(100, 100 - Math.abs(dailyStrain - 11) * 6));
    mfSum += sf * 0.30; mfN++;
  }
  const matchFitnessScore  = mfN > 0 ? Math.round(mfSum) : null;
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
    athlete: {
      id: athlete.id, firstName: athlete.firstName, lastName: athlete.lastName,
      role: athlete.role, weight, notes: athlete.notes ?? '', labResults: athlete.labResults ?? [],
    },
    matchFitness:   { score: matchFitnessScore, status: matchFitnessStatus, recommendation },
    energyRecovery: { recoveryScore, status: recoveryStatus, calories, kilojoules: kilojoules ? Math.round(kilojoules) : null },
    stressFatigue:  { dailyStrain, status: strainStatus, hrv, hrvStatus },
    heartRate:      { rhr, avgHR, maxHR, maxHRBpm, maxHRPct },
    sprintIntensity:{ maxHRPct, status: sprintStatus, maxHR, maxHRBpm },
    hydration:      { spo2, skinTemp, status: spo2Status },
    sleep:          { score: sleepScore, status: sleepStatus, efficiency: sleepEff, totalHours: totalSleepHrs, deepMinutes: deepMs ? Math.round(deepMs / 60000) : null, remMinutes: remMs ? Math.round(remMs / 60000) : null },
    injuryRisk:     { status: injuryStatus, factors: injuryFactors, score: injuryScore },
  };
}

// ── Fetch WHOOP data bundle and save to DB ───────────────────────────
async function fetchWhoopProfileBundle(athlete) {
  const now = Date.now();
  if (!athlete.tokens || !athlete.tokens.access_token) throw new Error('WHOOP token missing');

  if (athlete.tokens.expires_at && athlete.tokens.expires_at <= now + 30000 && athlete.tokens.refresh_token) {
    const refreshed = await refreshAccessToken(athlete.tokens.refresh_token);
    athlete.tokens = {
      ...athlete.tokens, ...refreshed,
      expires_at:   Date.now() + (Number(refreshed.expires_in || 3600) * 1000),
      refreshed_at: new Date().toISOString(),
    };
  }

  const accessToken = athlete.tokens.access_token;
  const endpoints   = [
    { key: 'profile',         path: '/user/profile/basic' },
    { key: 'bodyMeasurement', path: '/user/measurement/body' },
    { key: 'cycles',          path: '/cycle' },
    { key: 'recovery',        path: '/recovery' },
    { key: 'sleep',           path: '/activity/sleep' },
    { key: 'workout',         path: '/activity/workout' },
  ];

  const results = await Promise.all(endpoints.map(async item => {
    try {
      const value = await whoopGet(item.path, accessToken);
      return [item.key, { ok: true, data: value }];
    } catch (error) {
      return [item.key, { ok: false, error: error.message }];
    }
  }));

  athlete.whoopData = { fetchedAt: new Date().toISOString(), endpoints: Object.fromEntries(results) };

  await pool.query(
    'UPDATE athletes SET tokens = $1, whoop_data = $2, whoop_connected = true WHERE id = $3',
    [JSON.stringify(athlete.tokens), JSON.stringify(athlete.whoopData), athlete.id]
  );
}

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'bekalo-performance-hub', db: 'connected' });
  } catch {
    res.status(500).json({ ok: false, db: 'error' });
  }
});

// ── Auth routes ─────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const name     = String(req.body.name     || '').trim();
  const email    = String(req.body.email    || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Only the superadmin email gets admin role
    const role = email === SUPERADMIN_EMAIL ? 'admin' : 'user';

    const { rows } = await pool.query(
      'INSERT INTO bekalo_users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, name, passwordHash, role]
    );
    const user = rows[0];
    console.log(`[AUTH] Registered id=${user.id} email=${email} role=${role}`);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error('[AUTH] register:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const email    = String(req.body.email    || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  try {
    const { rows } = await pool.query('SELECT * FROM bekalo_users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error('[AUTH] login:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role FROM bekalo_users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── Team routes ─────────────────────────────────────────────────────
app.get('/api/teams', requireAuth, async (req, res) => {
  try {
    const { rows: teamRows } = await pool.query(
      'SELECT * FROM teams WHERE user_id = $1 ORDER BY created_at', [req.user.id]
    );
    if (teamRows.length === 0) return res.json([]);

    const teamIds = teamRows.map(t => t.id);
    const { rows: athleteRows } = await pool.query(
      'SELECT * FROM athletes WHERE team_id = ANY($1) ORDER BY created_at', [teamIds]
    );

    res.json(teamRows.map(team => ({
      id:       team.id,
      userId:   team.user_id,
      name:     team.name,
      athletes: athleteRows.filter(a => a.team_id === team.id).map(mapAthleteRow),
    })));
  } catch (err) {
    console.error('[TEAMS] GET:', err.message);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.post('/api/teams', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO teams (user_id, name) VALUES ($1, $2) RETURNING *', [req.user.id, name]
    );
    const t = rows[0];
    console.log(`[TEAMS] Created id=${t.id}`);
    res.status(201).json({ id: t.id, userId: t.user_id, name: t.name, athletes: [] });
  } catch (err) {
    console.error('[TEAMS] POST:', err.message);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.delete('/api/teams/:teamId', requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND user_id = $2', [teamId, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Team not found' });
    console.log(`[TEAMS] Deleted id=${teamId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TEAMS] DELETE:', err.message);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ── Athlete routes ───────────────────────────────────────────────────
app.post('/api/teams/:teamId/athletes', requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  const team   = await getTeam(teamId, req.user.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const firstName = String(req.body.firstName || '').trim();
  const lastName  = String(req.body.lastName  || '').trim();
  const role      = String(req.body.role      || '').trim();
  if (!firstName || !lastName || !role) return res.status(400).json({ error: 'firstName, lastName, role are required' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO athletes (team_id, first_name, last_name, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [teamId, firstName, lastName, role]
    );
    const athlete = mapAthleteRow(rows[0]);
    console.log(`[ATHLETES] Created id=${athlete.id} team=${teamId}`);
    res.status(201).json({ ...athlete, whoopAuthUrl: whoopAuthUrl(athlete.id) });
  } catch (err) {
    console.error('[ATHLETES] POST:', err.message);
    res.status(500).json({ error: 'Failed to create athlete' });
  }
});

app.delete('/api/athletes/:athleteId', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM athletes WHERE id = $1 AND team_id IN (SELECT id FROM teams WHERE user_id = $2)',
      [athleteId, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Athlete not found' });
    console.log(`[ATHLETES] Deleted id=${athleteId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ATHLETES] DELETE:', err.message);
    res.status(500).json({ error: 'Failed to delete athlete' });
  }
});

app.get('/api/athletes/:athleteId/dashboard', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result    = await getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });

  const { rows: labRows } = await pool.query(
    'SELECT * FROM lab_results WHERE athlete_id = $1 ORDER BY created_at DESC LIMIT 10', [athleteId]
  );
  result.athlete.labResults = labRows.map(r => ({
    date: r.date, category: r.category, biomarkers: r.biomarkers,
    summary: r.summary, redFlags: r.red_flags, recommendations: r.recommendations,
    analyzedAt: r.analyzed_at,
  }));

  const dashboard = transformWhoopToDashboard(result.athlete);
  if (!dashboard) return res.json({ noData: true, whoopConnected: result.athlete.whoopConnected });
  res.json(dashboard);
});

app.post('/api/athletes/:athleteId/whoop/sync', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result    = await getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  if (!athlete.whoopConnected) return res.status(400).json({ error: 'WHOOP not connected' });
  try {
    await fetchWhoopProfileBundle(athlete);
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/athletes/:athleteId/whoop/auth-url', requireAuth, async (req, res) => {
  cleanExpiredStates();
  const athleteId = Number(req.params.athleteId);
  if (!await getAthlete(athleteId, req.user.id)) return res.status(404).json({ error: 'Athlete not found' });
  const state  = createStateToken(athleteId);
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID, response_type: 'code',
    redirect_uri: WHOOP_POSTMAN_REDIRECT, scope: WHOOP_SCOPE, state,
  });
  res.json({ url: `${WHOOP_AUTH_URL}?${params.toString()}`, state });
});

app.post('/api/athletes/:athleteId/whoop/exchange', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result    = await getAthlete(athleteId, req.user.id);
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
    const response  = await fetch(WHOOP_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const tokenData = await response.json();
    if (!response.ok) throw new Error(tokenData.error_description || tokenData.error || `Token exchange failed: ${response.status}`);
    athlete.tokens = { ...tokenData, expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000), connected_at: new Date().toISOString() };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WHOOP OAuth browser redirect (no JWT) ───────────────────────────
app.get('/auth/whoop/login', async (req, res) => {
  cleanExpiredStates();
  if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) return res.status(500).send('Missing WHOOP credentials in .env');
  const athleteId = Number(req.query.athleteId);
  if (!athleteId || !await getAthlete(athleteId)) return res.status(400).send('athleteId required');
  res.redirect(whoopAuthUrl(athleteId));
});

app.get('/auth/whoop/callback', async (req, res) => {
  cleanExpiredStates();
  const code       = String(req.query.code  || '');
  const state      = String(req.query.state || '');
  const oauthError = String(req.query.error || '');

  if (oauthError) return res.status(400).send(`WHOOP OAuth error: ${oauthError}. Go back and click "Connect WHOOP" again.`);

  const statePayload = oauthStates.get(state);
  oauthStates.delete(state);
  if (!code || !statePayload) return res.status(400).send('Invalid OAuth callback. Go back and reconnect.');

  const result = await getAthlete(Number(statePayload.athleteId));
  if (!result) return res.status(404).send('Athlete not found');
  const { athlete } = result;

  try {
    const tokenData = await exchangeCodeForToken(code);
    athlete.tokens = { ...tokenData, expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000), connected_at: new Date().toISOString() };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    res.redirect(`/?connectedAthlete=${athlete.id}`);
  } catch (error) {
    res.status(500).send(`WHOOP OAuth error: ${error.message}`);
  }
});

// ── Team overview ────────────────────────────────────────────────────
app.get('/api/teams/:teamId/overview', requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  const team   = await getTeam(teamId, req.user.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { rows } = await pool.query('SELECT * FROM athletes WHERE team_id = $1 ORDER BY created_at', [teamId]);
  const athletes = rows.map(mapAthleteRow);

  const withData = athletes
    .filter(a => a.whoopData)
    .map(a => ({ athlete: a, d: transformWhoopToDashboard(a) }))
    .filter(({ d }) => d !== null);

  const numVals = (key, sub) =>
    withData.map(({ d }) => d[key]?.[sub]).filter(v => v !== null && v !== undefined && !isNaN(v));

  const avg = (key, sub) => {
    const v = numVals(key, sub);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  const mfScores    = withData.map(({ d }) => d.matchFitness.score).filter(v => v !== null);
  const teamFitness = mfScores.length ? Math.round(mfScores.reduce((a, b) => a + b, 0) / mfScores.length) : null;

  const statusColor = teamFitness === null ? 'gray' : teamFitness >= 67 ? 'green' : teamFitness >= 40 ? 'yellow' : 'red';
  const statusLabel = teamFitness === null ? 'No Data' : teamFitness >= 67 ? 'Ready' : teamFitness >= 40 ? 'Moderate' : 'Low';

  const avgHrvRaw    = withData.map(({ d }) => d.stressFatigue.hrv).filter(v => v !== null && v !== undefined);
  const avgHrv       = avgHrvRaw.length ? Math.round(avgHrvRaw.reduce((a, b) => a + b, 0) / avgHrvRaw.length * 10) / 10 : null;

  const avgSprintRaw = withData.map(({ d }) => d.sprintIntensity.maxHRPct).filter(v => v !== null && v !== undefined);
  const avgSprintPct = avgSprintRaw.length ? Math.round(avgSprintRaw.reduce((a, b) => a + b, 0) / avgSprintRaw.length) : null;

  const readyCount    = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score >= 67).length;
  const moderateCount = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score >= 40 && d.matchFitness.score < 67).length;
  const lowCount      = withData.filter(({ d }) => d.matchFitness.score !== null && d.matchFitness.score < 40).length;
  const readinessPct  = withData.length > 0 ? Math.round(readyCount / withData.length * 100) : null;

  const highStrainCount  = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain >= 14).length;
  const modStrainCount   = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain >= 7 && d.stressFatigue.dailyStrain < 14).length;
  const lightStrainCount = withData.filter(({ d }) => d.stressFatigue.dailyStrain !== null && d.stressFatigue.dailyStrain < 7).length;
  const goodHrvCount     = withData.filter(({ d }) => d.stressFatigue.hrv !== null && d.stressFatigue.hrv >= 50).length;

  const atRisk = withData
    .filter(({ d }) => d.injuryRisk.status.color === 'red')
    .map(({ athlete, d }) => ({
      name: `${athlete.firstName} ${athlete.lastName}`, role: athlete.role,
      matchFitness: d.matchFitness.score, statusColor: d.matchFitness.status.color,
      statusLabel: d.matchFitness.status.label, factors: d.injuryRisk.factors,
    }));

  const allPlayers = athletes.map(athlete => {
    const wd = withData.find(w => w.athlete.id === athlete.id);
    if (wd) {
      const d = wd.d;
      return {
        name: `${athlete.firstName} ${athlete.lastName}`, role: athlete.role, synced: true,
        matchFitness: d.matchFitness.score, statusColor: d.matchFitness.status.color,
        statusLabel: d.matchFitness.status.label,
        recovery: d.energyRecovery.recoveryScore, sleep: d.sleep.score,
        strain: d.stressFatigue.dailyStrain !== null ? parseFloat(d.stressFatigue.dailyStrain.toFixed(1)) : null,
        hrv: d.stressFatigue.hrv !== null ? Math.round(d.stressFatigue.hrv) : null,
        sprintPct: d.sprintIntensity.maxHRPct, injuryColor: d.injuryRisk.status.color,
      };
    }
    return {
      name: `${athlete.firstName} ${athlete.lastName}`, role: athlete.role, synced: false,
      matchFitness: null, statusColor: 'gray', statusLabel: 'No Data',
      recovery: null, sleep: null, strain: null, hrv: null, sprintPct: null, injuryColor: 'gray',
    };
  });

  res.json({
    teamName: team.name, totalPlayers: athletes.length, syncedPlayers: withData.length,
    teamFitness, statusColor, statusLabel,
    avgRecovery: avg('energyRecovery', 'recoveryScore'),
    avgSleep:    avg('sleep', 'score'),
    avgStrain:   (() => { const v = numVals('stressFatigue', 'dailyStrain'); return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : null; })(),
    avgHrv, avgSprintPct,
    readyCount, moderateCount, lowCount, readinessPct,
    highStrainCount, modStrainCount, lightStrainCount, goodHrvCount,
    atRisk, allPlayers,
  });
});

// ── AI Chat ─────────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  const { message, history = [], teamId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  let playerContext = '';
  if (teamId && teamId !== '__demo__') {
    const team = await getTeam(Number(teamId), req.user.id);
    if (team) {
      const { rows } = await pool.query('SELECT * FROM athletes WHERE team_id = $1', [team.id]);
      const athletes = rows.map(mapAthleteRow);
      playerContext = `\n\nCurrent team: "${team.name}"\nPlayers:\n`;
      for (const athlete of athletes) {
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.7 }),
    });
    const data = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(data.error?.message || `OpenAI ${openaiRes.status}`);
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Coach notes ──────────────────────────────────────────────────────
app.patch('/api/athletes/:athleteId/notes', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result    = await getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const notes = String(req.body.notes ?? '').slice(0, 5000);
  await pool.query('UPDATE athletes SET notes = $1 WHERE id = $2', [notes, athleteId]);
  res.json({ ok: true });
});

// ── Lab Analysis (OpenAI Vision) ─────────────────────────────────────
app.post('/api/athletes/:athleteId/analyze-lab', requireAuth, async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result    = await getAthlete(athleteId, req.user.id);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'imageBase64 and mimeType required' });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OpenAI not configured' });

  const prompt = `You are a sports medicine AI analyzing lab results for a professional football player. Analyze this lab report image and extract ALL visible values. Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "date": "YYYY-MM-DD or null",
  "category": "type of test e.g. Hormonal Panel / Complete Blood Count / Metabolic Panel",
  "biomarkers": [
    {
      "name": "Testosterone",
      "value": 18.5,
      "unit": "nmol/L",
      "refMin": 9.9,
      "refMax": 27.8,
      "status": "normal",
      "performanceNote": "one sentence implication for football performance"
    }
  ],
  "summary": "2-3 sentence coach-friendly summary of key findings and what they mean for training",
  "redFlags": ["list critical values needing immediate action, or empty array"],
  "recommendations": ["actionable training/nutrition/recovery recommendations based on results"]
}
Status values: normal, low, high, critical_low, critical_high. Extract every visible value.`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
        ]}],
        max_tokens: 1500, temperature: 0.1,
      }),
    });
    const data = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(data.error?.message || `OpenAI ${openaiRes.status}`);

    const raw      = data.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const analysis = JSON.parse(raw);
    const analyzedAt = new Date().toISOString();

    await pool.query(
      `INSERT INTO lab_results (athlete_id, date, category, biomarkers, summary, red_flags, recommendations, analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [athleteId, analysis.date || null, analysis.category,
       JSON.stringify(analysis.biomarkers), analysis.summary,
       JSON.stringify(analysis.redFlags), JSON.stringify(analysis.recommendations), analyzedAt]
    );

    // Prune to 10 most recent per athlete
    await pool.query(
      `DELETE FROM lab_results WHERE athlete_id = $1 AND id NOT IN (
         SELECT id FROM lab_results WHERE athlete_id = $1 ORDER BY created_at DESC LIMIT 10
       )`,
      [athleteId]
    );

    res.json({ ok: true, analysis: { ...analysis, analyzedAt } });
  } catch (err) {
    console.error('[LAB]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Weather (Open-Meteo, free, no key) ───────────────────────────────
function wmoCodeToLabel(code) {
  if (code === 0)   return 'Clear sky';
  if (code <= 3)    return 'Partly cloudy';
  if (code <= 49)   return 'Foggy';
  if (code <= 59)   return 'Drizzle';
  if (code <= 69)   return 'Rain';
  if (code <= 79)   return 'Snow';
  if (code <= 84)   return 'Rain showers';
  if (code <= 99)   return 'Thunderstorm';
  return 'Unknown';
}
function wmoCodeToEmoji(code) {
  if (code === 0)   return '☀️';
  if (code <= 3)    return '⛅';
  if (code <= 49)   return '🌫️';
  if (code <= 59)   return '🌦️';
  if (code <= 69)   return '🌧️';
  if (code <= 79)   return '❄️';
  if (code <= 84)   return '🌦️';
  if (code <= 99)   return '⛈️';
  return '🌡️';
}

app.get('/api/weather', requireAuth, async (req, res) => {
  const location = String(req.query.location || '').trim();
  const date     = String(req.query.date     || '').trim();
  if (!location || !date) return res.status(400).json({ error: 'location and date required' });

  try {
    const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return res.status(404).json({ error: `Location not found: "${location}"` });

    const { latitude, longitude, name, country } = geoData.results[0];
    const matchDate = new Date(date);
    const daysAhead = (matchDate - Date.now()) / 86400000;
    if (daysAhead < -1) return res.json({ available: false, reason: 'past',    locationName: `${name}, ${country}` });
    if (daysAhead > 16) return res.json({ available: false, reason: 'too_far', locationName: `${name}, ${country}` });

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
      available: true, locationName: `${name}, ${country}`,
      temperature:  Math.round(fData.hourly.temperature_2m[hour]),
      precipitation: fData.hourly.precipitation_probability[hour] ?? 0,
      windspeed:    Math.round(fData.hourly.windspeed_10m[hour]),
      condition:    wmoCodeToLabel(code), emoji: wmoCodeToEmoji(code),
    });
  } catch (err) {
    console.error('[WEATHER]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Football calendar ─────────────────────────────────────────────────
let calendarCache = {};

app.get('/api/calendar', requireAuth, async (req, res) => {
  if (!FOOTBALL_API_KEY) return res.status(503).json({ error: 'FOOTBALL_API_KEY not configured, add it to .env' });
  const teamId = String(req.query.teamId || '108');
  const cached = calendarCache[teamId];
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return res.json(cached.data);

  try {
    const r = await fetch(
      `${FOOTBALL_API_BASE}/teams/${teamId}/matches?status=SCHEDULED&limit=5`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || `football-data.org ${r.status}`);

    const matches = (data.matches || []).slice(0, 5).map(m => ({
      id: m.id, date: m.utcDate,
      home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
      away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
      competition: m.competition?.name || '', homeId: m.homeTeam?.id,
    }));

    const result = { matches, teamName: data.matches?.[0]?.homeTeam?.name || 'Team' };
    calendarCache[teamId] = { ts: Date.now(), data: result };
    res.json(result);
  } catch (err) {
    console.error('[CALENDAR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Password reset ───────────────────────────────────────────────────
async function sendResetEmail(email, code) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[AUTH] *** Password reset code for ${email}: ${code} ***`);
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from: EMAIL_FROM || `"Bekalo Hub" <${SMTP_USER}>`,
    to: email,
    subject: 'Your Bekalo password reset code',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;border-radius:12px;padding:32px;color:#f1f5f9">
        <div style="text-align:center;margin-bottom:24px">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#6366f1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <h2 style="margin:8px 0 0;font-size:20px;color:#f1f5f9">Bekalo Performance Hub</h2>
        </div>
        <p style="margin:0 0 8px;color:#94a3b8;font-size:14px">Your password reset code:</p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#6366f1;margin:0 0 24px">
          ${code}
        </div>
        <p style="margin:0;color:#64748b;font-size:12px">This code expires in 1 hour and can only be used once. If you did not request a reset, ignore this email.</p>
      </div>`,
  });
}

app.post('/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { rows } = await pool.query('SELECT id FROM bekalo_users WHERE email = $1', [email]);
    if (!rows[0]) return res.json({ ok: true }); // don't reveal if email exists

    const code      = String(Math.floor(100000 + Math.random() * 900000));
    const hash      = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
      [rows[0].id]
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [rows[0].id, hash, expiresAt]
    );

    await sendResetEmail(email, code);
    console.log(`[AUTH] Password reset requested for ${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] forgot-password:', err.message);
    res.status(500).json({ error: 'Failed to send reset code' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  const email    = String(req.body.email    || '').toLowerCase().trim();
  const code     = String(req.body.code     || '').trim();
  const password = String(req.body.password || '');

  if (!email || !code || !password) return res.status(400).json({ error: 'email, code and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { rows: userRows } = await pool.query('SELECT id FROM bekalo_users WHERE email = $1', [email]);
    if (!userRows[0]) return res.status(400).json({ error: 'Invalid code' });

    const { rows: tokenRows } = await pool.query(
      `SELECT id, token_hash FROM password_reset_tokens
       WHERE user_id = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userRows[0].id]
    );
    if (!tokenRows[0]) return res.status(400).json({ error: 'Code expired or already used' });

    const valid = await bcrypt.compare(code, tokenRows[0].token_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE bekalo_users SET password_hash = $1 WHERE id = $2', [passwordHash, userRows[0].id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenRows[0].id]);

    console.log(`[AUTH] Password reset completed for ${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] reset-password:', err.message);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── Admin routes ─────────────────────────────────────────────────────

app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [users, teams, athletes, admins] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM bekalo_users'),
      pool.query('SELECT COUNT(*) FROM teams'),
      pool.query('SELECT COUNT(*) FROM athletes'),
      pool.query("SELECT COUNT(*) FROM bekalo_users WHERE role = 'admin'"),
    ]);
    res.json({
      totalUsers:    parseInt(users.rows[0].count),
      totalTeams:    parseInt(teams.rows[0].count),
      totalAthletes: parseInt(athletes.rows[0].count),
      totalAdmins:   parseInt(admins.rows[0].count),
    });
  } catch (err) {
    console.error('[ADMIN] stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
             COUNT(DISTINCT t.id)::int  AS team_count,
             COUNT(DISTINCT a.id)::int  AS athlete_count
      FROM bekalo_users u
      LEFT JOIN teams    t ON t.user_id  = u.id
      LEFT JOIN athletes a ON a.team_id  = t.id
      GROUP BY u.id
      ORDER BY u.created_at
    `);
    res.json(rows.map(r => ({
      id: r.id, email: r.email, name: r.name, role: r.role,
      createdAt: r.created_at,
      teamCount: r.team_count, athleteCount: r.athlete_count,
    })));
  } catch (err) {
    console.error('[ADMIN] users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const role     = String(req.body.role || '');
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be "user" or "admin"' });

  try {
    const { rows } = await pool.query(
      'UPDATE bekalo_users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, targetId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    console.log(`[ADMIN] User id=${targetId} role set to ${role} by admin id=${req.user.id}`);
    res.json(rows[0]);
  } catch (err) {
    console.error('[ADMIN] role update:', err.message);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

app.get('/api/admin/teams', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.name, t.created_at,
             u.id   AS owner_id,   u.email AS owner_email, u.name AS owner_name,
             COUNT(a.id)::int AS athlete_count
      FROM teams t
      JOIN bekalo_users u ON t.user_id = u.id
      LEFT JOIN athletes a ON a.team_id = t.id
      GROUP BY t.id, u.id
      ORDER BY t.created_at
    `);
    res.json(rows.map(r => ({
      id: r.id, name: r.name, createdAt: r.created_at,
      owner: { id: r.owner_id, email: r.owner_email, name: r.owner_name },
      athleteCount: r.athlete_count,
    })));
  } catch (err) {
    console.error('[ADMIN] teams:', err.message);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ── SPA fallback ─────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Startup ──────────────────────────────────────────────────────────
const HOST = IS_PROD ? '0.0.0.0' : '127.0.0.1';

runMigrations()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`[SERVER] Bekalo running on ${HOST}:${PORT} (${IS_PROD ? 'production' : 'development'})`);
      console.log(`[SERVER] APP_BASE_URL = ${APP_BASE_URL}`);
    });
  })
  .catch(err => {
    console.error('[STARTUP] Migration failed, aborting:', err.message);
    process.exit(1);
  });
