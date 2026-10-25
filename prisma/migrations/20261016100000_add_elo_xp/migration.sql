-- CreateEnum
CREATE TYPE "EloXp" AS ENUM ('CURIOSO', 'ACADEMICO', 'INTERNO', 'R1', 'R3', 'R6', 'STAFF_DO_SERVICO');

-- AlterTable
ALTER TABLE "progressos_xp" ADD COLUMN "maiorElo" "EloXp" NOT NULL DEFAULT 'CURIOSO';

