-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoItemLoja" ADD VALUE 'DICA';
ALTER TYPE "TipoItemLoja" ADD VALUE 'POTENCIALIZADOR';

-- DropIndex
DROP INDEX "transacoes_moedas_usuarioId_itemLojaId_fonte_key";

-- AlterTable
ALTER TABLE "inventario_itens" ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "itens_loja" ADD COLUMN     "consumivel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "efeito" TEXT;

-- AlterTable
ALTER TABLE "transacoes_moedas" ADD COLUMN     "quantidadeItem" INTEGER;
