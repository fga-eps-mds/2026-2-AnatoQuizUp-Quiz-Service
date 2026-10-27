import { z } from "zod";

import { TIPO_QUESTAO_API } from "../questoes/dto/question.types";
import { VALORES_DIFICULDADE } from "../questoes/questoes.schemas";

// Schemas Zod do quiz: filtros de busca, resposta e historico.

// Query da busca de questoes: filtros opcionais e paginacao (limite ate 100).
export const schemaBuscarQuestaoQuiz = z.object({
  tema: z.string().trim().optional(),

  dificuldade: z.enum(VALORES_DIFICULDADE).optional(),

  tipo: z.enum([TIPO_QUESTAO_API.MULTIPLA_ESCOLHA, TIPO_QUESTAO_API.CERTO_ERRADO]).optional(),

  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Body da resposta: union discriminada por "tipo" para validar as alternativas certas.
// tentativaId (opcional) liga a resposta a uma rodada de quiz.
export const schemaResponderQuestaoQuiz = z.discriminatedUnion("tipo", [
  // Multipla escolha: alternativas de A a E.
  z.object({
    questaoId: z.string().trim().min(1),

    tipo: z.literal(TIPO_QUESTAO_API.MULTIPLA_ESCOLHA),

    respostaMarcada: z.enum(["A", "B", "C", "D", "E"]),

    tentativaId: z.string().trim().min(1).optional(),
  }),

  // Certo/errado: apenas C (certo) ou E (errado).
  z.object({
    questaoId: z.string().trim().min(1),

    tipo: z.literal(TIPO_QUESTAO_API.CERTO_ERRADO),

    respostaMarcada: z.enum(["C", "E"]),

    tentativaId: z.string().trim().min(1).optional(),
  }),
]);

// Query do historico: mesmos filtros/paginacao da busca de questoes.
export const schemaHistoricoQuizQuestoesUsuario = z.object({
  tema: z.string().trim().optional(),

  dificuldade: z.enum(VALORES_DIFICULDADE).optional(),

  tipo: z.enum([TIPO_QUESTAO_API.MULTIPLA_ESCOLHA, TIPO_QUESTAO_API.CERTO_ERRADO]).optional(),

  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// A consulta administrativa usa instantes com offset explícito e intervalo limitado.
export const schemaMetricasProdutoR2 = z.object({
  inicio: z.iso.datetime({ offset: true }),
  fim: z.iso.datetime({ offset: true }),
}).refine(({ inicio, fim }) => {
  const duracao = new Date(fim).getTime() - new Date(inicio).getTime();
  return duracao > 0 && duracao <= 90 * 24 * 60 * 60 * 1000;
}, { message: "O intervalo deve ser positivo e ter até 90 dias." });
