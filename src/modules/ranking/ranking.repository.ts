import { Prisma } from '@prisma/client';

import { prisma } from '@/config/db';

export interface LinhaPontuacao {
  usuarioId: string;
  acertos: bigint;
  respondidas: bigint;
  ultimaAtividade: Date | null;
  xpTotal: number | bigint | null;
}

export class RankingRepository {
  /**
   * Agrega o desempenho de cada usuário a partir das resoluções de questões
   * e junta o XP acumulado (0 para quem ainda não concluiu nenhuma rodada de
   * quiz). Quando `usuarioIds` é informado, restringe o cálculo a esses
   * usuários (usado pelo ranking de amigos); caso contrário, considera todos
   * os participantes (ranking geral).
   *
   * O cálculo é feito em uma única query agregada para evitar carregar todas
   * as resoluções na memória.
   */
  async agregarPontuacoes(usuarioIds?: string[]): Promise<LinhaPontuacao[]> {
    const filtroIds =
      usuarioIds && usuarioIds.length > 0
        ? Prisma.sql`AND r."usuarioId" IN (${Prisma.join(usuarioIds)})`
        : Prisma.empty;

    return prisma.$queryRaw<LinhaPontuacao[]>(Prisma.sql`
      SELECT
        r."usuarioId" AS "usuarioId",
        COUNT(*) FILTER (WHERE r."respostaMarcada" = q."respostaCorreta") AS "acertos",
        COUNT(*) AS "respondidas",
        MAX(r."criadoEm") AS "ultimaAtividade",
        COALESCE(MAX(p."xpTotal"), 0) AS "xpTotal"
      FROM "resolucoes_questoes" r
      JOIN "questoes" q ON q."id" = r."questaoId"
      LEFT JOIN "progressos_xp" p ON p."usuarioId" = r."usuarioId"
      WHERE r."excluidoEm" IS NULL
      ${filtroIds}
      GROUP BY r."usuarioId"
    `);
  }
}
