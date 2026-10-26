-- AlterTable
ALTER TABLE "transacoes_xp" ADD COLUMN     "xpEloApos" INTEGER NOT NULL DEFAULT 0;

-- Backfill: antes da US #89 o XP de elo era o proprio XP total, entao as transacoes
-- historicas podem reconstruir o elo da epoca a partir do acumulado total.
UPDATE "transacoes_xp" SET "xpEloApos" = "xpTotalApos";
