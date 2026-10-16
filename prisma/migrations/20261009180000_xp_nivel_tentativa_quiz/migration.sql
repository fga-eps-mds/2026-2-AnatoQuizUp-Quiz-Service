-- CreateEnum
CREATE TYPE "StatusTentativaQuiz" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "OrigemXp" AS ENUM ('QUIZ_CONCLUIDO');

-- AlterTable
ALTER TABLE "resolucoes_questoes" ADD COLUMN "tentativaId" TEXT;

-- CreateTable
CREATE TABLE "tentativas_quiz" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tema" TEXT,
    "dificuldade" "Dificuldade",
    "questaoIds" TEXT[],
    "totalQuestoes" INTEGER NOT NULL,
    "totalAcertos" INTEGER,
    "status" "StatusTentativaQuiz" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "tentativas_quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progressos_xp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progressos_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes_xp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tentativaId" TEXT,
    "origem" "OrigemXp" NOT NULL DEFAULT 'QUIZ_CONCLUIDO',
    "xpBase" INTEGER NOT NULL,
    "bonusDesempenho" INTEGER NOT NULL,
    "bonusPowerUp" INTEGER NOT NULL DEFAULT 0,
    "quantidade" INTEGER NOT NULL,
    "xpTotalApos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_xp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tentativas_quiz_usuarioId_iniciadaEm_idx" ON "tentativas_quiz"("usuarioId", "iniciadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "progressos_xp_usuarioId_key" ON "progressos_xp"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_xp_tentativaId_key" ON "transacoes_xp"("tentativaId");

-- CreateIndex
CREATE INDEX "transacoes_xp_usuarioId_criadoEm_idx" ON "transacoes_xp"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "resolucoes_questoes_tentativaId_questaoId_key" ON "resolucoes_questoes"("tentativaId", "questaoId");

-- AddForeignKey
ALTER TABLE "resolucoes_questoes" ADD CONSTRAINT "resolucoes_questoes_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "tentativas_quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes_xp" ADD CONSTRAINT "transacoes_xp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "progressos_xp"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes_xp" ADD CONSTRAINT "transacoes_xp_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "tentativas_quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
