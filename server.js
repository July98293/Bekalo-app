require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 8899);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DB_FILE = path.join(__dirname, 'db.json');

const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || '';
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || '';
const WHOOP_AUTH_URL = process.env.WHOOP_AUTH_URL || 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = process.env.WHOOP_TOKEN_URL || 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = process.env.WHOOP_API_BASE || 'https://api.prod.whoop.com/developer/v2';
const WHOOP_SCOPE = process.env.WHOOP_SCOPE || 'offline read:profile read:recovery read:sleep read:workout read:cycles read:body_measurement';
const WHOOP_REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || `${APP_BASE_URL}/auth/whoop/callback`;
const WHOOP_POSTMAN_REDIRECT = 'https://oauth.pstmn.io/v1/callback';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const saved = JSON.parse(raw);
    return {
      teams:         saved.teams         || [],
      nextTeamId:    saved.nextTeamId    || 1,
      nextAthleteId: saved.nextAthleteId || 1,
      oauthStates:   new Map(),
    };
  } catch {
    return { teams: [], nextTeamId: 1, nextAthleteId: 1, oauthStates: new Map() };
  }
}

function saveDb() {
  try {
    const { teams, nextTeamId, nextAthleteId } = db;
    fs.writeFileSync(DB_FILE, JSON.stringify({ teams, nextTeamId, nextAthleteId }, null, 2));
  } catch (err) {
    console.error('[DB] saveDb failed:', err.message);
  }
}

function logDbState(label) {
  console.log(`[DB] ${label} | teams: ${db.teams.length} | ids: [${db.teams.map(t => `${t.id}:"${t.name}"(${t.athletes.length})`).join(', ')}]`);
}

const db = loadDb();
console.log(`[DB] Loaded from ${DB_FILE}`);
logDbState('startup');

const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Request logger ─────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    console.log(`[REQ] ${req.method} ${req.path}`, Object.keys(req.body || {}).length ? req.body : '');
  }
  next();
});

function getTeam(teamId) {
  return db.teams.find((t) => t.id === teamId);
}

function getAthlete(athleteId) {
  for (const team of db.teams) {
    const athlete = team.athletes.find((a) => a.id === athleteId);
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
    if (val === null || val === undefined) return { label: 'N/D', color: 'gray' };
    for (let i = 0; i < cuts.length; i++) if (val >= cuts[i]) return { label: labels[i], color: colors[i] };
    return { label: labels.at(-1), color: colors.at(-1) };
  };

  const recoveryStatus = badge(recoveryScore, [67, 34], ['Ottimale','Moderato','Basso'],           ['green','yellow','red']);
  const sleepStatus    = badge(sleepScore,    [67, 34], ['Ottimale','Sufficiente','Insufficiente'], ['green','yellow','red']);
  const strainStatus   = badge(dailyStrain,   [18, 14, 8], ['Massimale','Elevato','Moderato','Leggero'], ['red','orange','yellow','green']);
  const hrvStatus      = badge(hrv,           [80, 50, 30], ['Ottimale','Buono','Moderato','Critico'],   ['green','yellow','orange','red']);
  const sprintStatus   = badge(maxHRPct,      [90, 75], ['Alta intensità','Moderata','Bassa'], ['red','yellow','green']);

  const spo2Status = spo2 !== null
    ? (spo2 >= 95 ? { label: 'Buona',    color: 'green'  }
     : spo2 >= 90 ? { label: 'Attenzione', color: 'yellow' }
     :              { label: 'Critica',  color: 'red'    })
    : { label: 'N/D', color: 'gray' };

  let injuryScore = 0, injuryFactors = [];
  if (recoveryScore !== null && recoveryScore < 34) { injuryScore += 3; injuryFactors.push('Recovery basso'); }
  if (hrv !== null && hrv < 30)                    { injuryScore += 3; injuryFactors.push('HRV critico'); }
  if (dailyStrain !== null && dailyStrain > 17)    { injuryScore += 2; injuryFactors.push('Strain massimale'); }
  if (sleepScore !== null && sleepScore < 34)      { injuryScore += 2; injuryFactors.push('Sonno insufficiente'); }
  const injuryStatus = injuryScore === 0 ? { label: 'Basso', color: 'green' }
    : injuryScore <= 3 ? { label: 'Moderato', color: 'yellow' }
    : { label: 'Alto', color: 'red' };

  let mfSum = 0, mfN = 0;
  if (recoveryScore !== null) { mfSum += recoveryScore * 0.40; mfN++; }
  if (sleepScore    !== null) { mfSum += sleepScore    * 0.30; mfN++; }
  if (dailyStrain   !== null) {
    const sf = Math.max(0, Math.min(100, 100 - Math.abs(dailyStrain - 11) * 6));
    mfSum += sf * 0.30; mfN++;
  }
  const matchFitnessScore = mfN > 0 ? Math.round(mfSum) : null;
  const matchFitnessStatus = badge(matchFitnessScore, [67, 40], ['Pronto','Parzialmente','Non Pronto'], ['green','yellow','red']);

  const recommendation = (() => {
    if (recoveryScore === null) return 'Sincronizza WHOOP per ricevere raccomandazioni personalizzate.';
    if (recoveryScore >= 67 && (dailyStrain === null || dailyStrain <= 13)) return 'Condizioni ottimali — seduta ad alta intensità raccomandata.';
    if (recoveryScore >= 67) return 'Recovery buono ma carico elevato — considera sessione tecnica o rigenerativa.';
    if (recoveryScore >= 34) return 'Allenamento tecnico-tattico a media intensità consigliato.';
    return 'Recovery critico — riposo attivo o seduta rigenerativa obbligatoria.';
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

  const results = await Promise.all(endpoints.map(async (item) => {
    try {
      const value = await whoopGet(item.path, accessToken);
      return [item.key, { ok: true, data: value }];
    } catch (error) {
      return [item.key, { ok: false, error: error.message }];
    }
  }));

  const data = Object.fromEntries(results);
  athlete.whoopData = {
    fetchedAt: new Date().toISOString(),
    endpoints: data,
  };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'whoop-team-app',
    whoopRedirectUri: WHOOP_REDIRECT_URI,
    hasCredentials: Boolean(WHOOP_CLIENT_ID && WHOOP_CLIENT_SECRET),
  });
});

app.post('/api/teams', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name required' });
  const team = { id: db.nextTeamId++, name, athletes: [] };
  db.teams.push(team);
  saveDb();
  logDbState(`team created id=${team.id}`);
  res.status(201).json(team);
});

app.delete('/api/teams/:teamId', (req, res) => {
  const teamId = Number(req.params.teamId);
  const idx = db.teams.findIndex((t) => t.id === teamId);
  if (idx === -1) {
    console.log(`[DB] DELETE team ${teamId} — not found. current ids: [${db.teams.map(t => t.id).join(', ')}]`);
    return res.status(404).json({ error: 'Team not found' });
  }
  db.teams.splice(idx, 1);
  saveDb();
  logDbState(`team deleted id=${teamId}`);
  res.json({ ok: true });
});

app.get('/api/teams', (_req, res) => {
  res.json(db.teams);
});

app.post('/api/teams/:teamId/athletes', (req, res) => {
  const teamId = Number(req.params.teamId);
  const team = getTeam(teamId);
  if (!team) {
    console.log(`[DB] POST athlete — team ${teamId} not found. current ids: [${db.teams.map(t => t.id).join(', ')}]`);
    return res.status(404).json({ error: 'Team not found' });
  }

  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const role = String(req.body.role || '').trim();
  if (!firstName || !lastName || !role) {
    return res.status(400).json({ error: 'firstName, lastName, role are required' });
  }

  const athlete = {
    id: db.nextAthleteId++,
    firstName,
    lastName,
    role,
    whoopConnected: false,
    tokens: null,
    whoopData: null,
    createdAt: new Date().toISOString(),
  };
  team.athletes.push(athlete);
  saveDb();
  logDbState(`athlete created id=${athlete.id} team=${teamId}`);
  res.status(201).json({ ...athlete, whoopAuthUrl: whoopAuthUrl(athlete.id) });
});

app.delete('/api/athletes/:athleteId', (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId);
  if (!result) {
    console.log(`[DB] DELETE athlete ${athleteId} — not found`);
    return res.status(404).json({ error: 'Athlete not found' });
  }
  const { team } = result;
  team.athletes = team.athletes.filter((a) => a.id !== athleteId);
  saveDb();
  logDbState(`athlete deleted id=${athleteId}`);
  res.json({ ok: true });
});

app.get('/api/athletes/:athleteId', async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  res.json(athlete);
});

app.get('/api/athletes/:athleteId/dashboard', (_req, res) => {
  const athleteId = Number(_req.params.athleteId);
  const result = getAthlete(athleteId);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  const dashboard = transformWhoopToDashboard(athlete);
  if (!dashboard) return res.status(200).json({ noData: true, whoopConnected: athlete.whoopConnected });
  res.json(dashboard);
});

app.post('/api/athletes/:athleteId/whoop/sync', async (_req, res) => {
  const athleteId = Number(_req.params.athleteId);
  const result = getAthlete(athleteId);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  if (!athlete.whoopConnected) return res.status(400).json({ error: 'WHOOP not connected', whoopAuthUrl: whoopAuthUrl(athlete.id) });
  try {
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/athletes/:athleteId/whoop/auth-url', (req, res) => {
  cleanExpiredStates();
  const athleteId = Number(req.params.athleteId);
  if (!getAthlete(athleteId)) return res.status(404).json({ error: 'Athlete not found' });
  const state = createStateToken(athleteId);
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    response_type: 'code',
    redirect_uri: WHOOP_POSTMAN_REDIRECT,
    scope: WHOOP_SCOPE,
    state,
  });
  res.json({ url: `${WHOOP_AUTH_URL}?${params.toString()}`, state });
});

app.post('/api/athletes/:athleteId/whoop/exchange', async (req, res) => {
  const athleteId = Number(req.params.athleteId);
  const result = getAthlete(athleteId);
  if (!result) return res.status(404).json({ error: 'Athlete not found' });
  const { athlete } = result;
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'code is required' });

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    redirect_uri: WHOOP_POSTMAN_REDIRECT,
  });
  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tokenData = await response.json();
    if (!response.ok) throw new Error(tokenData.error_description || tokenData.error || `Token exchange failed: ${response.status}`);
    athlete.tokens = {
      ...tokenData,
      expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000),
      connected_at: new Date().toISOString(),
    };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.json({ ok: true, dashboard: transformWhoopToDashboard(athlete) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/whoop/login', (req, res) => {
  cleanExpiredStates();
  if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
    return res.status(500).send('Missing WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET in .env');
  }
  const athleteId = Number(req.query.athleteId);
  if (!athleteId || !getAthlete(athleteId)) return res.status(400).send('athleteId is required and must exist');
  res.redirect(whoopAuthUrl(athleteId));
});

app.get('/auth/whoop/callback', async (req, res) => {
  cleanExpiredStates();
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const oauthError = String(req.query.error || '');
  const oauthErrorDescription = String(req.query.error_description || '');

  if (oauthError) {
    return res.status(400).send(
      `WHOOP OAuth error: ${oauthError}${oauthErrorDescription ? ` - ${oauthErrorDescription}` : ''}. Torna alla home e clicca di nuovo "Collega WHOOP".`
    );
  }

  const statePayload = db.oauthStates.get(state);
  db.oauthStates.delete(state);

  if (!code || !statePayload) {
    return res.status(400).send(
      'Invalid OAuth callback (code/state missing). Apri la home, crea/seleziona atleta e usa il bottone "Collega WHOOP" per generare un nuovo state valido.'
    );
  }
  const result = getAthlete(Number(statePayload.athleteId));
  if (!result) return res.status(404).send('Athlete not found');
  const { athlete } = result;

  try {
    const tokenData = await exchangeCodeForToken(code);
    athlete.tokens = {
      ...tokenData,
      expires_at: Date.now() + (Number(tokenData.expires_in || 3600) * 1000),
      connected_at: new Date().toISOString(),
    };
    athlete.whoopConnected = true;
    await fetchWhoopProfileBundle(athlete);
    saveDb();
    res.redirect(`/?connectedAthlete=${athlete.id}`);
  } catch (error) {
    res.status(500).send(`WHOOP OAuth error: ${error.message}`);
  }
});

app.post('/api/chat', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const { message, history = [], teamId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // Build player context from current team data
  let playerContext = '';
  if (teamId) {
    const team = db.teams.find(t => t.id === Number(teamId));
    if (team) {
      playerContext = `\n\nCurrent team: "${team.name}"\nPlayers and their latest biometric data:\n`;
      for (const athlete of team.athletes) {
        playerContext += `\n— ${athlete.firstName} ${athlete.lastName} (${athlete.role})`;
        if (athlete.whoopData) {
          const d = transformWhoopToDashboard(athlete);
          if (d) {
            playerContext += `
  Match Fitness Score: ${d.matchFitness.score ?? 'N/A'}/100 (${d.matchFitness.status.label})
  Recovery: ${d.energyRecovery.recoveryScore ?? 'N/A'}/100
  Daily Strain: ${d.stressFatigue.dailyStrain ?? 'N/A'}/21
  HRV: ${d.stressFatigue.hrv ? d.stressFatigue.hrv.toFixed(1) + ' ms' : 'N/A'}
  Resting HR: ${d.heartRate.rhr ? d.heartRate.rhr + ' bpm' : 'N/A'}
  Sleep Score: ${d.sleep.score ?? 'N/A'}/100 (${d.sleep.totalHours ? d.sleep.totalHours + 'h' : 'N/A'})
  Injury Risk: ${d.injuryRisk.status.label}${d.injuryRisk.factors.length ? ' — ' + d.injuryRisk.factors.join(', ') : ''}
  Recommendation: ${d.matchFitness.recommendation}`;
          }
        } else {
          playerContext += ' — no WHOOP data yet';
        }
      }
    }
  }

  const systemPrompt = `You are Bekalo AI Coach, an expert football performance analyst and sports scientist embedded in the Bekalo Performance Hub platform. You analyse WHOOP biometric data for professional football players and give concise, actionable insights to coaches and performance staff.

Your style: direct, professional, evidence-based. Use football terminology. Keep answers focused and under 200 words unless asked for detail. Reply in the same language the coach writes in.${playerContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.7 }),
    });
    const data = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(data.error?.message || `OpenAI ${openaiRes.status}`);
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const HOST = IS_PROD ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[SERVER] Bekalo running on ${HOST}:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  console.log(`[SERVER] APP_BASE_URL = ${APP_BASE_URL}`);
  console.log(`[SERVER] WHOOP redirect URI = ${WHOOP_REDIRECT_URI}`);
  console.log(`[SERVER] DB file = ${DB_FILE}`);
});
