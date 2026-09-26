-- CreateEnum
CREATE TYPE "TipoEfeitoItem" AS ENUM ('DOBRAR_MOEDAS_PROXIMO_ACERTO');

-- CreateEnum
CREATE TYPE "StatusUsoItem" AS ENUM ('ATIVO', 'APLICADO');

-- AlterEnum
ALTER TYPE "FonteMoeda" ADD VALUE 'USO_POTENCIALIZADOR';

-- AlterTable
ALTER TABLE "itens_loja" ADD COLUMN "tipoEfeito" "TipoEfeitoItem";

-- CreateTable
CREATE TABLE "usos_itens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "itemLojaId" TEXT NOT NULL,
    "tipoEfeito" "TipoEfeitoItem" NOT NULL,
    "status" "StatusUsoItem" NOT NULL DEFAULT 'ATIVO',
    "chaveUsoPendente" TEXT,
    "questaoId" TEXT,
    "ativadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEm" TIMESTAMP(3),

    CONSTRAINT "usos_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usos_itens_chaveUsoPendente_key" ON "usos_itens"("chaveUsoPendente");
CREATE INDEX "usos_itens_usuarioId_ativadoEm_idx" ON "usos_itens"("usuarioId", "ativadoEm");
CREATE INDEX "usos_itens_usuarioId_status_idx" ON "usos_itens"("usuarioId", "status");
CREATE INDEX "usos_itens_questaoId_idx" ON "usos_itens"("questaoId");

-- AddForeignKey
ALTER TABLE "usos_itens" ADD CONSTRAINT "usos_itens_itemLojaId_fkey"
  FOREIGN KEY ("itemLojaId") REFERENCES "itens_loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usos_itens" ADD CONSTRAINT "usos_itens_questaoId_fkey"
  FOREIGN KEY ("questaoId") REFERENCES "questoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
