-- CreateEnum
CREATE TYPE "EstadoElo" AS ENUM ('ATIVO', 'EM_RISCO', 'REBAIXADO');

-- CreateEnum
CREATE TYPE "TipoEventoElo" AS ENUM ('PROMOCAO', 'REBAIXAMENTO', 'RECUPERACAO');

-- CreateEnum
CREATE TYPE "TipoNotificacaoElo" AS ENUM ('AVISO_PREVENTIVO', 'ELO_EM_RISCO', 'VESPERA_REBAIXAMENTO', 'ELO_REBAIXADO', 'ELO_RECUPERADO');

-- AlterTable
ALTER TABLE "progressos_xp" ADD COLUMN     "eloAtual" "EloXp" NOT NULL DEFAULT 'CURIOSO',
ADD COLUMN     "rebaixamentosAplicados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimaAtividadeEm" TIMESTAMP(3),
ADD COLUMN     "xpElo" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "eventos_elo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoEventoElo" NOT NULL,
    "eloAnterior" "EloXp" NOT NULL,
    "eloNovo" "EloXp" NOT NULL,
    "xpEloAntes" INTEGER NOT NULL,
    "xpEloDepois" INTEGER NOT NULL,
    "diasInatividade" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_elo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes_elo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacaoElo" NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "eloRelacionado" "EloXp",
    "prazoRebaixamentoEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_elo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_inatividade" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "diasAviso" INTEGER NOT NULL DEFAULT 7,
    "diasRisco" INTEGER NOT NULL DEFAULT 8,
    "diasRebaixamento" INTEGER NOT NULL DEFAULT 9,
    "diasEntreRebaixamentos" INTEGER NOT NULL DEFAULT 14,
    "indisponibilidades" JSONB NOT NULL DEFAULT '[]',
    "atualizadoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_inatividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_elo_usuarioId_criadoEm_idx" ON "eventos_elo"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "notificacoes_elo_usuarioId_criadoEm_idx" ON "notificacoes_elo"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_elo_usuarioId_tipo_chave_key" ON "notificacoes_elo"("usuarioId", "tipo", "chave");

-- AddForeignKey
ALTER TABLE "eventos_elo" ADD CONSTRAINT "eventos_elo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "progressos_xp"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: quem ja acumulou XP comeca com o XP de elo igual ao XP total e com o elo
-- atual igual ao maior elo ja conquistado. A ultima atividade valida e inferida da
-- transacao de XP mais recente (ou da ultima atualizacao do saldo, se nao houver),
-- para que a primeira execucao da rotina de inatividade nao rebaixe quem esta ativo.
UPDATE "progressos_xp" p
SET "xpElo" = p."xpTotal",
    "eloAtual" = p."maiorElo",
    "ultimaAtividadeEm" = COALESCE(
      (SELECT MAX(t."criadoEm") FROM "transacoes_xp" t WHERE t."usuarioId" = p."usuarioId"),
      p."atualizadoEm"
    );
