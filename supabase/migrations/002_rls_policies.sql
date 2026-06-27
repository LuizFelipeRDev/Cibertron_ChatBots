-- ============================================
-- Punkbot - RLS Policies para Isolamento por Device
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Políticas para a tabela sessions
-- ============================================

-- Usuário só pode VER suas próprias sessões
CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT
  USING (device_id = current_setting('app.device_id', true));

-- Usuário só pode CRIAR/ATUALIZAR suas próprias sessões
CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT
  WITH CHECK (device_id = current_setting('app.device_id', true));

CREATE POLICY "sessions_update_own" ON sessions
  FOR UPDATE
  USING (device_id = current_setting('app.device_id', true));

-- Usuário só pode DELETAR suas próprias sessões
CREATE POLICY "sessions_delete_own" ON sessions
  FOR DELETE
  USING (device_id = current_setting('app.device_id', true));

-- ============================================
-- Políticas para a tabela messages
-- ============================================

-- Usuário só pode VER mensagens das suas sessões
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

-- Usuário só pode INSERIR mensagens nas suas sessões
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

-- Usuário só pode DELETAR mensagens das suas sessões
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );
