-- ============================================
-- Punkbot - Perfil de Usuário (passivo)
-- ============================================

-- Tabela de perfis: dados coletados passivamente
CREATE TABLE profiles (
  device_id TEXT PRIMARY KEY,
  name TEXT,
  location TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas: cada device só vê/altera seu próprio perfil
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (device_id = current_setting('app.device_id', true));

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (device_id = current_setting('app.device_id', true));

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (device_id = current_setting('app.device_id', true));

CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE
  USING (device_id = current_setting('app.device_id', true));
