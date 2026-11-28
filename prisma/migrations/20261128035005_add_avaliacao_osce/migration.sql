-- CreateTable
CREATE TABLE "itens_checklist_osce" (
    "id" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criterioCompleto" TEXT NOT NULL,
    "criterioParcial" TEXT,
    "peso" INTEGER NOT NULL,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "comentarioFeedback" TEXT,
    "ordem" INTEGER NOT NULL,
    "casoOsceId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_checklist_osce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_avaliacao_osce" (
    "id" TEXT NOT NULL,
    "faixaExcelente" INTEGER NOT NULL DEFAULT 90,
    "faixaBom" INTEGER NOT NULL DEFAULT 75,
    "faixaSuficiente" INTEGER NOT NULL DEFAULT 60,
    "faixaLimitrofe" INTEGER NOT NULL DEFAULT 50,
    "corteAprovacao" INTEGER NOT NULL DEFAULT 60,
    "itemCriticoReprova" BOOLEAN NOT NULL DEFAULT true,
    "escalaGlobal" JSONB,
    "liberarResultado" BOOLEAN NOT NULL DEFAULT true,
    "casoOsceId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_avaliacao_osce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itens_checklist_osce_casoOsceId_idx" ON "itens_checklist_osce"("casoOsceId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_avaliacao_osce_casoOsceId_key" ON "configuracoes_avaliacao_osce"("casoOsceId");

-- AddForeignKey
ALTER TABLE "itens_checklist_osce" ADD CONSTRAINT "itens_checklist_osce_casoOsceId_fkey" FOREIGN KEY ("casoOsceId") REFERENCES "casos_osce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_avaliacao_osce" ADD CONSTRAINT "configuracoes_avaliacao_osce_casoOsceId_fkey" FOREIGN KEY ("casoOsceId") REFERENCES "casos_osce"("id") ON DELETE CASCADE ON UPDATE CASCADE;
