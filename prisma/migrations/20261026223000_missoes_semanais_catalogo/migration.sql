-- Catálogo semanal aprovado pelos Product Owners.
-- Permanece inativo para evitar crédito de XP antes da publicação da tela Web.
-- A ativação deve ocorrer somente após o deploy conjunto do Quiz-Service e do Web.
INSERT INTO "missoes_catalogo"
  ("id", "codigo", "nome", "descricao", "tipo", "periodicidade", "meta", "recompensaXp", "ativa")
VALUES
  ('semanal-constancia', 'CONSTANCIA_SEMANAL', 'Constância semanal', 'Responda 20 questões diferentes nesta semana.', 'RESPONDER_QUESTOES', 'SEMANAL', 20, 100, false),
  ('semanal-exploracao', 'EXPLORACAO_SEMANAL', 'Exploração semanal', 'Responda 30 questões diferentes nesta semana.', 'RESPONDER_QUESTOES', 'SEMANAL', 30, 150, false),
  ('semanal-precisao', 'PRECISAO_SEMANAL', 'Precisão semanal', 'Acerte 15 questões diferentes nesta semana.', 'ACERTAR_QUESTOES', 'SEMANAL', 15, 140, false),
  ('semanal-acertos', 'ACERTOS_SEMANAIS', 'Acertos semanais', 'Acerte 25 questões diferentes nesta semana.', 'ACERTAR_QUESTOES', 'SEMANAL', 25, 180, false),
  ('semanal-variedade', 'VARIEDADE_SEMANAL', 'Variedade semanal', 'Conclua 4 quizzes de combinações diferentes de tema e dificuldade nesta semana.', 'CONCLUIR_QUIZZES', 'SEMANAL', 4, 180, false),
  ('semanal-ritmo', 'RITMO_SEMANAL', 'Ritmo semanal', 'Conclua 6 quizzes de combinações diferentes de tema e dificuldade nesta semana.', 'CONCLUIR_QUIZZES', 'SEMANAL', 6, 220, false)
ON CONFLICT ("codigo") DO NOTHING;
