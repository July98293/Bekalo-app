-- Bekalo Performance Hub — Initial Schema
-- Safe to run multiple times (IF NOT EXISTS throughout)

CREATE TABLE IF NOT EXISTS bekalo_users (
  id           SERIAL PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255)        NOT NULL,
  password_hash VARCHAR(255)       NOT NULL,
  role         VARCHAR(10)         NOT NULL DEFAULT 'user'
                 CHECK (role IN ('user', 'admin')),
  created_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES bekalo_users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);

-- athletes.position stores what the app calls athlete.role (e.g. "Left Winger")
-- tokens and whoop_data are stored as JSONB to mirror the original object shapes
CREATE TABLE IF NOT EXISTS athletes (
  id             SERIAL PRIMARY KEY,
  team_id        INTEGER      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name     VARCHAR(255) NOT NULL,
  last_name      VARCHAR(255) NOT NULL,
  position       VARCHAR(255),
  whoop_connected BOOLEAN     NOT NULL DEFAULT FALSE,
  notes          TEXT                  DEFAULT '',
  tokens         JSONB,
  whoop_data     JSONB,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_athletes_team_id ON athletes(team_id);

CREATE TABLE IF NOT EXISTS lab_results (
  id              SERIAL PRIMARY KEY,
  athlete_id      INTEGER      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date            DATE,
  category        VARCHAR(255),
  biomarkers      JSONB,
  summary         TEXT,
  red_flags       JSONB,
  recommendations JSONB,
  analyzed_at     TIMESTAMPTZ           DEFAULT NOW(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_athlete_id ON lab_results(athlete_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES bekalo_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
