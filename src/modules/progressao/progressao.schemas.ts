import { z } from "zod";

import { VALORES_DIFICULDADE } from "../questoes/questoes.schemas";

// Schemas Zod do modulo de progressao.

// Body para iniciar uma rodada: tema e dificuldade sao opcionais.
export const schemaIniciarTentativa = z.object({
  tema: z.string().trim().min(1).optional(),

  dificuldade: z.enum(VALORES_DIFICULDADE).optional(),
});

// Params das rotas que recebem o id da rodada.
export const schemaParamsTentativa = z.object({
  id: z.string().trim().min(1),
});

// Query do historico de XP (paginacao).
export const schemaHistoricoXp = z.object({
  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Params das rotas que recebem o id de uma notificacao.
export const schemaParamsNotificacao = z.object({
  id: z.string().trim().min(1),
});

// Query da listagem de notificacoes.
export const schemaListarNotificacoes = z.object({
  apenasNaoLidas: z
    .enum(["true", "false"])
    .optional()
    .transform((valor) => valor === "true"),
});

// Janela de indisponibilidade reconhecida da plataforma.
const schemaJanelaIndisponibilidade = z
  .object({
    inicio: z.string().datetime(),

    fim: z.string().datetime(),
  })
  .refine((janela) => new Date(janela.fim) > new Date(janela.inicio), {
    message: "O fim da indisponibilidade deve ser posterior ao inicio.",
  });

// Body da configuracao de inatividade (somente ADMINISTRADOR).
// A ordem dos prazos e validada aqui para que nao exista configuracao impossivel, como
// avisar depois de ja ter rebaixado.
export const schemaConfiguracaoInatividade = z
  .object({
    diasAviso: z.coerce.number().int().min(1).max(365),

    diasRisco: z.coerce.number().int().min(1).max(365),

    diasRebaixamento: z.coerce.number().int().min(1).max(365),

    diasEntreRebaixamentos: z.coerce.number().int().min(1).max(365),

    indisponibilidades: z.array(schemaJanelaIndisponibilidade).max(100).default([]),
  })
  .refine((config) => config.diasAviso <= config.diasRisco, {
    message: "O aviso preventivo deve vir antes do estado de risco.",
    path: ["diasAviso"],
  })
  .refine((config) => config.diasRisco < config.diasRebaixamento, {
    message: "O estado de risco deve vir antes do rebaixamento.",
    path: ["diasRisco"],
  });
