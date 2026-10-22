-- CreateEnum
CREATE TYPE "TipoMissao" AS ENUM ('RESPONDER_QUESTOES', 'ACERTAR_QUESTOES', 'CONCLUIR_QUIZZES');

-- CreateEnum
CREATE TYPE "PeriodicidadeMissao" AS ENUM ('DIARIA', 'SEMANAL');

-- AlterEnum
ALTER TYPE "OrigemXp" ADD VALUE 'MISSAO_CONCLUIDA';

-- AlterTable
ALTER TABLE "transacoes_xp" ADD COLUMN     "missaoUsuarioId" TEXT;

-- CreateTable
CREATE TABLE "missoes_catalogo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoMissao" NOT NULL,
    "periodicidade" "PeriodicidadeMissao" NOT NULL DEFAULT 'DIARIA',
    "meta" INTEGER NOT NULL,
    "recompensaXp" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missoes_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_missoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "periodicidade" "PeriodicidadeMissao" NOT NULL DEFAULT 'DIARIA',
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missoes_usuario" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "missaoId" TEXT NOT NULL,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "missoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_missao" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,

    CONSTRAINT "eventos_missao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "missoes_catalogo_codigo_key" ON "missoes_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_missoes_usuarioId_periodicidade_inicio_key" ON "periodos_missoes"("usuarioId", "periodicidade", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "missoes_usuario_periodoId_missaoId_key" ON "missoes_usuario"("periodoId", "missaoId");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_missao_periodoId_tipo_chave_key" ON "eventos_missao"("periodoId", "tipo", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_xp_missaoUsuarioId_key" ON "transacoes_xp"("missaoUsuarioId");

-- AddForeignKey
ALTER TABLE "transacoes_xp" ADD CONSTRAINT "transacoes_xp_missaoUsuarioId_fkey" FOREIGN KEY ("missaoUsuarioId") REFERENCES "missoes_usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes_usuario" ADD CONSTRAINT "missoes_usuario_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes_usuario" ADD CONSTRAINT "missoes_usuario_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "missoes_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_missao" ADD CONSTRAINT "eventos_missao_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Catálogo inicial fixo. As três primeiras missões foram validadas pelo PO.
INSERT INTO "missoes_catalogo" ("id", "codigo", "nome", "descricao", "tipo", "meta", "recompensaXp") VALUES
('missao-aquecimento', 'AQUECIMENTO_DIARIO', 'Aquecimento diário', 'Responda 5 questões em qualquer quiz.', 'RESPONDER_QUESTOES', 5, 30),
('missao-precisao', 'PRECISAO_ANATOMICA', 'Precisão anatômica', 'Acerte 8 questões durante os quizzes.', 'ACERTAR_QUESTOES', 8, 50),
('missao-ritmo', 'RITMO_ESTUDO', 'Ritmo de estudo', 'Conclua 3 quizzes com tema ou dificuldade diferentes.', 'CONCLUIR_QUIZZES', 3, 70),
('missao-pratica', 'PRATICA_DIARIA', 'Prática diária', 'Responda 10 questões em qualquer quiz.', 'RESPONDER_QUESTOES', 10, 50),
('missao-acertos', 'BONS_ACERTOS', 'Bons acertos', 'Acerte 5 questões durante os quizzes.', 'ACERTAR_QUESTOES', 5, 30),
('missao-variedade', 'VARIEDADE_ESTUDO', 'Variedade de estudo', 'Conclua 2 quizzes com tema ou dificuldade diferentes.', 'CONCLUIR_QUIZZES', 2, 50)
ON CONFLICT ("codigo") DO NOTHING;
