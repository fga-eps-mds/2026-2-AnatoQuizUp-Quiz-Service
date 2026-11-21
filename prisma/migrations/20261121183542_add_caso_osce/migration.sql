-- CreateEnum
CREATE TYPE "StatusCasoOsce" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateTable
CREATE TABLE "casos_osce" (
    "id" TEXT NOT NULL,
    "titulo" TEXT,
    "especialidade" TEXT,
    "dificuldade" "Dificuldade",
    "diagnosticoEsperado" TEXT,
    "local" TEXT,
    "papelEstudante" TEXT,
    "idadePaciente" INTEGER,
    "sexoPaciente" TEXT,
    "queixaPaciente" TEXT,
    "perfilPaciente" TEXT,
    "historiaSintomas" TEXT,
    "exameFisico" TEXT,
    "status" "StatusCasoOsce" NOT NULL DEFAULT 'RASCUNHO',
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "casos_osce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exames_caso_osce" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "casoOsceId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exames_caso_osce_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "exames_caso_osce" ADD CONSTRAINT "exames_caso_osce_casoOsceId_fkey" FOREIGN KEY ("casoOsceId") REFERENCES "casos_osce"("id") ON DELETE CASCADE ON UPDATE CASCADE;
