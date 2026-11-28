import { z } from "zod";

import { Dificuldade } from "@prisma/client";

// Schemas Zod das rotas de casos OSCE. Todo campo e opcional (rascunho preenchido
// aos poucos pelo editor em passos, com autosave a cada etapa).

const exame = z.object({
  nome: z.string().trim().min(1).max(200),
  resultado: z.string().trim().min(1).max(2000),
});

export const schemaSalvarCasoOsce = z.object({
  titulo: z.string().trim().min(1).max(300).optional(),
  especialidade: z.string().trim().min(1).max(200).optional(),
  dificuldade: z.enum(Dificuldade).optional(),
  diagnosticoEsperado: z.string().trim().min(1).max(500).optional(),
  local: z.string().trim().min(1).max(300).optional(),
  papelEstudante: z.string().trim().min(1).max(300).optional(),
  idadePaciente: z.coerce.number().int().min(0).max(130).optional(),
  sexoPaciente: z.string().trim().min(1).max(50).optional(),
  queixaPaciente: z.string().trim().min(1).max(500).optional(),
  perfilPaciente: z.string().trim().min(1).max(2000).optional(),
  historiaSintomas: z.string().trim().min(1).max(5000).optional(),
  exameFisico: z.string().trim().min(1).max(5000).optional(),
  exames: z.array(exame).max(20).optional(),
});

export const schemaListarCasosOsce = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const schemaBuscarCasoOscePorId = z.object({
  id: z.string().trim().min(1),
});

// Avaliacao do caso (US27): checklist e regras de nota.
const itemChecklist = z.object({
  dominio: z.string().trim().min(1).max(200),
  nome: z.string().trim().min(1).max(300),
  criterioCompleto: z.string().trim().min(1).max(2000),
  criterioParcial: z.string().trim().min(1).max(2000).optional(),
  peso: z.literal([1, 2]),
  critico: z.boolean().default(false),
  comentarioFeedback: z.string().trim().min(1).max(2000).optional(),
});

// A lista e enviada inteira; a posicao de cada item define a ordem.
export const schemaSalvarChecklist = z.object({
  itens: z.array(itemChecklist).max(50),
});

const percentual = z.number().int().min(0).max(100);

export const schemaSalvarConfiguracaoAvaliacao = z
  .object({
    faixaExcelente: percentual,
    faixaBom: percentual,
    faixaSuficiente: percentual,
    faixaLimitrofe: percentual,
    corteAprovacao: percentual,
    itemCriticoReprova: z.boolean(),
    escalaGlobal: z.array(z.string().trim().min(1).max(100)).length(5),
    liberarResultado: z.boolean().default(true),
  })
  .refine(
    (c) =>
      c.faixaExcelente > c.faixaBom &&
      c.faixaBom > c.faixaSuficiente &&
      c.faixaSuficiente > c.faixaLimitrofe,
    { message: "As faixas devem estar em ordem decrescente.", path: ["faixaExcelente"] },
  );