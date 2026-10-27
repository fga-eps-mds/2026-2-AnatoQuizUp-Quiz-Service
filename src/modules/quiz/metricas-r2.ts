import { prisma } from "@/config/db";

type Fluxo = {
  iniciados: number;
  concluidos: number;
  questoes: number;
  acertos: number;
};
type Retorno = { elegiveis: number; retornaram: number };

/** Agregados da R2 sem expor IDs ou respostas individuais de estudantes. */
export async function buscarMetricasProdutoR2(inicio: Date, fim: Date) {
  const [fluxo] = await prisma.$queryRaw<Fluxo[]>`
    SELECT
      COUNT(*)::int AS "iniciados",
      COUNT(*) FILTER (WHERE "status" = 'CONCLUIDA')::int AS "concluidos",
      COALESCE(SUM("totalQuestoes") FILTER (WHERE "status" = 'CONCLUIDA'), 0)::int AS "questoes",
      COALESCE(SUM("totalAcertos") FILTER (WHERE "status" = 'CONCLUIDA'), 0)::int AS "acertos"
    FROM "tentativas_quiz"
    WHERE "iniciadaEm" >= ${inicio} AND "iniciadaEm" < ${fim}
  `;
  const [retorno] = await prisma.$queryRaw<Retorno[]>`
    WITH primeira AS (
      SELECT "usuarioId", MIN("concluidaEm") AS instante
      FROM "tentativas_quiz"
      WHERE "status" = 'CONCLUIDA'
        AND "concluidaEm" >= ${inicio}
        AND "concluidaEm" < ${fim}
      GROUP BY "usuarioId"
    )
    SELECT
      COUNT(*) FILTER (WHERE instante + INTERVAL '7 days' <= ${fim})::int AS "elegiveis",
      COUNT(*) FILTER (
        WHERE instante + INTERVAL '7 days' <= ${fim}
          AND EXISTS (
            SELECT 1 FROM "tentativas_quiz" AS segunda
            WHERE segunda."usuarioId" = primeira."usuarioId"
              AND segunda."status" = 'CONCLUIDA'
              AND segunda."concluidaEm" >= primeira.instante + INTERVAL '24 hours'
              AND segunda."concluidaEm" <= primeira.instante + INTERVAL '7 days'
          )
      )::int AS "retornaram"
    FROM primeira
  `;

  const iniciados = fluxo?.iniciados ?? 0;
  const concluidos = fluxo?.concluidos ?? 0;
  const questoes = fluxo?.questoes ?? 0;
  const acertos = fluxo?.acertos ?? 0;
  const elegiveis = retorno?.elegiveis ?? 0;
  const retornaram = retorno?.retornaram ?? 0;
  return {
    periodo: { inicio: inicio.toISOString(), fimExclusivo: fim.toISOString() },
    quizzes: {
      iniciados,
      concluidos,
      taxaConclusao: iniciados ? Number(((concluidos / iniciados) * 100).toFixed(2)) : null,
    },
    questoes: {
      respondidasEmQuizzesConcluidos: questoes,
      acertos,
      taxaAcerto: questoes ? Number(((acertos / questoes) * 100).toFixed(2)) : null,
    },
    retornoSeteDias: {
      elegiveis,
      retornaram,
      taxaRetorno: elegiveis ? Number(((retornaram / elegiveis) * 100).toFixed(2)) : null,
    },
  };
}
