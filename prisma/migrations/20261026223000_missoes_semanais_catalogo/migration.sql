-- Catálogo semanal proposto para revisão dos Product Owners.
-- A estrutura de periodicidade foi criada junto com as missões diárias.
INSERT INTO "missoes_catalogo"
  ("id", "codigo", "nome", "descricao", "tipo", "periodicidade", "meta", "recompensaXp")
VALUES
  ('semanal-constancia', 'CONSTANCIA_SEMANAL', 'Constância semanal', 'Responda 20 questões diferentes nesta semana.', 'RESPONDER_QUESTOES', 'SEMANAL', 20, 100),
  ('semanal-exploracao', 'EXPLORACAO_SEMANAL', 'Exploração semanal', 'Responda 30 questões diferentes nesta semana.', 'RESPONDER_QUESTOES', 'SEMANAL', 30, 150),
  ('semanal-precisao', 'PRECISAO_SEMANAL', 'Precisão semanal', 'Acerte 15 questões diferentes nesta semana.', 'ACERTAR_QUESTOES', 'SEMANAL', 15, 140),
  ('semanal-acertos', 'ACERTOS_SEMANAIS', 'Acertos semanais', 'Acerte 25 questões diferentes nesta semana.', 'ACERTAR_QUESTOES', 'SEMANAL', 25, 180),
  ('semanal-variedade', 'VARIEDADE_SEMANAL', 'Variedade semanal', 'Conclua 4 quizzes de combinações diferentes de tema e dificuldade nesta semana.', 'CONCLUIR_QUIZZES', 'SEMANAL', 4, 180),
  ('semanal-ritmo', 'RITMO_SEMANAL', 'Ritmo semanal', 'Conclua 6 quizzes de combinações diferentes de tema e dificuldade nesta semana.', 'CONCLUIR_QUIZZES', 'SEMANAL', 6, 220)
ON CONFLICT ("codigo") DO NOTHING;
