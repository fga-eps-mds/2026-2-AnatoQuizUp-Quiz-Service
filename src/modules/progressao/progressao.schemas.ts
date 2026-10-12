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
