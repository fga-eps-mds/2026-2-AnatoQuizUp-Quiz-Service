import { bloquearMissoes, contabilizarQuiz } from "@/modules/missoes/missoes.repository";
import { EloXp, StatusTentativaQuiz } from "@prisma/client";
import type { Dificuldade, Prisma } from "@prisma/client";

import { prisma } from "@/config/db";
import type { RegistroQuestaoCompleta } from "@/modules/questoes/dto/question.types";
import type { ParametrosPaginacao } from "@/shared/utils/paginacao.util";

import { creditarXp } from "./elo.repository";
import type { DadosProgressoElo, IniciarTentativaDto, RecompensaXpDto } from "./progressao.types";

// Repository da progressao (Prisma): rodadas de quiz, XP acumulado e historico de XP.

// Rodada com o necessario para corrigir e concluir: respostas + gabarito + XP ja pago.
const includeTentativaParaConclusao = {
  respostas: {
    where: { excluidoEm: null },
    select: {
      questaoId: true,
      respostaMarcada: true,
      questao: { select: { respostaCorreta: true, dificuldade: true } },
    },
  },
  transacaoXp: true,
} satisfies Prisma.TentativaQuizInclude;

export type TentativaParaConclusao = Prisma.TentativaQuizGetPayload<{
  include: typeof includeTentativaParaConclusao;
}>;

// Linha do historico de XP com a rodada relacionada.
const includeHistoricoXp = {
  missaoUsuario: { select: { missao: { select: { codigo: true, nome: true } } } },
  tentativa: {
    select: {
      id: true,
      tema: true,
      dificuldade: true,
      totalQuestoes: true,
      totalAcertos: true,
    },
  },
} satisfies Prisma.TransacaoXpInclude;

export type TransacaoXpComTentativa = Prisma.TransacaoXpGetPayload<{
  include: typeof includeHistoricoXp;
}>;

// Dados para fechar uma rodada. recompensa = null quando o usuario nao pontua
// (professor/administrador jogando o quiz).
type ConcluirTentativaParams = {
  tentativaId: string;
  usuarioId: string;
  totalAcertos: number;
  recompensa: RecompensaXpDto | null;
};

export type DadosProgressoBanco = DadosProgressoElo & {
  ultimaAtividadeEm: Date | null;
  rebaixamentosAplicados: number;
};

export class ProgressaoRepository {
  /**
   * Lista os ids de todas as questoes ativas que atendem aos filtros da rodada.
   *
   * @param filtros Tema (nome exato, sem diferenciar maiusculas) e dificuldade.
   * @returns Ids das questoes elegiveis.
   */
  async listarIdsQuestoesDisponiveis(filtros: IniciarTentativaDto): Promise<string[]> {
    const where: Prisma.QuestaoWhereInput = {
      status: "ATIVO",
      excluidoEm: null,
      ...(filtros.tema && { tema: { nome: { equals: filtros.tema, mode: "insensitive" } } }),
      ...(filtros.dificuldade && { dificuldade: filtros.dificuldade }),
    };

    const questoes = await prisma.questao.findMany({ where, select: { id: true } });

    return questoes.map((questao) => questao.id);
  }

  /**
   * Busca as questoes completas (tema + alternativas) de uma lista de ids.
   *
   * @param ids Ids das questoes sorteadas.
   * @returns Questoes completas, sem ordem garantida.
   */
  async buscarQuestoesPorIds(ids: string[]): Promise<RegistroQuestaoCompleta[]> {
    const questoes = await prisma.questao.findMany({
      where: { id: { in: ids } },
      include: { tema: true, alternativas: true },
    });

    return questoes as RegistroQuestaoCompleta[];
  }

  /**
   * Cria a rodada ja com as questoes sorteadas e o total gravado.
   *
   * @param usuarioId Dono da rodada.
   * @param filtros Tema/dificuldade escolhidos.
   * @param questaoIds Questoes da rodada, na ordem de exibicao.
   * @returns A rodada criada.
   */
  async criarTentativa(
    usuarioId: string,
    filtros: { tema: string | null; dificuldade: Dificuldade | null },
    questaoIds: string[],
  ) {
    return await prisma.tentativaQuiz.create({
      data: {
        usuarioId,
        tema: filtros.tema,
        dificuldade: filtros.dificuldade,
        questaoIds,
        totalQuestoes: questaoIds.length,
      },
    });
  }

  /**
   * Busca uma rodada do usuario com respostas, gabarito e XP ja pago.
   *
   * @param tentativaId Id da rodada.
   * @param usuarioId Dono esperado (impede acessar rodada de outro usuario).
   * @returns A rodada, ou null se nao existir/nao for do usuario.
   */
  async buscarTentativaParaConclusao(
    tentativaId: string,
    usuarioId: string,
  ): Promise<TentativaParaConclusao | null> {
    return await prisma.tentativaQuiz.findFirst({
      where: { id: tentativaId, usuarioId },
      include: includeTentativaParaConclusao,
    });
  }

  /**
   * Fecha a rodada e credita o XP numa unica transacao, de forma idempotente.
   *
   * A troca de status so acontece se a rodada ainda estiver EM_ANDAMENTO; se
   * outra requisicao ja a concluiu, nada e creditado (concluidaAgora = false).
   * A chave unica de tentativaId em transacoes_xp e a segunda barreira.
   * Tambem atualiza `maiorElo` caso o novo XP alcance uma faixa superior.
   *
   * @param params Rodada, acertos e recompensa calculada.
   * @returns Se a rodada foi concluida por esta chamada.
   */
  async concluirTentativa(params: ConcluirTentativaParams): Promise<{
    concluidaAgora: boolean;
    missoesConcluidas?: { nome: string; recompensaXp: number }[];
  }> {
    const { tentativaId, usuarioId, totalAcertos, recompensa } = params;

    return await prisma.$transaction(async (tx) => {
      if (recompensa) await bloquearMissoes(tx, usuarioId);
      const agora = new Date();
      const atualizadas = await tx.tentativaQuiz.updateMany({
        where: { id: tentativaId, usuarioId, status: StatusTentativaQuiz.EM_ANDAMENTO },
        data: {
          status: StatusTentativaQuiz.CONCLUIDA,
          concluidaEm: agora,
          totalAcertos,
        },
      });

      // Ja concluida por outra requisicao: nao credita de novo.
      if (atualizadas.count === 0) {
        return { concluidaAgora: false };
      }

      if (recompensa) {
        // Concluir uma rodada que concede XP e a atividade valida da US #89: soma nos dois
        // saldos, reinicia a contagem de inatividade e pode recuperar um elo perdido.
        const progresso = await creditarXp(tx, usuarioId, recompensa.xpTotalRecebido, agora);

        await tx.transacaoXp.create({
          data: {
            usuarioId,
            tentativaId,
            xpBase: recompensa.xpBase,
            bonusDesempenho: recompensa.bonusDesempenho,
            bonusPowerUp: recompensa.bonusPowerUp,
            quantidade: recompensa.xpTotalRecebido,
            xpTotalApos: progresso.xpTotal,
            xpEloApos: progresso.xpElo,
          },
        });
      }

      let missoesConcluidas: { nome: string; recompensaXp: number }[] = [];
      if (recompensa) {
        const tentativa = await tx.tentativaQuiz.findUniqueOrThrow({
          where: { id: tentativaId },
          select: { tema: true, dificuldade: true },
        });
        missoesConcluidas = await contabilizarQuiz(
          tx,
          usuarioId,
          tentativa.tema,
          tentativa.dificuldade,
          agora,
        );
      }
      return { concluidaAgora: true, missoesConcluidas };
    });
  }

  /**
   * XP acumulado do usuario (0 se ainda nao recebeu XP).
   *
   * @param usuarioId Id do usuario.
   * @returns XP total.
   */
  async buscarXpTotal(usuarioId: string): Promise<number> {
    const progresso = await prisma.progressoXp.findUnique({
      where: { usuarioId },
      select: { xpTotal: true },
    });

    return progresso?.xpTotal ?? 0;
  }

  /**
   * Estado de XP e elo do usuario: os dois saldos, o elo atual, o maior elo conquistado
   * e os dados de inatividade.
   *
   * @param usuarioId Id do usuario.
   * @returns Estado do progresso (zerado e CURIOSO se ainda nao houver registro).
   */
  async buscarDadosProgresso(usuarioId: string): Promise<DadosProgressoBanco> {
    const progresso = await prisma.progressoXp.findUnique({
      where: { usuarioId },
      select: {
        xpTotal: true,
        xpElo: true,
        eloAtual: true,
        maiorElo: true,
        ultimaAtividadeEm: true,
        rebaixamentosAplicados: true,
      },
    });

    return {
      xpTotal: progresso?.xpTotal ?? 0,
      xpElo: progresso?.xpElo ?? 0,
      eloAtual: progresso?.eloAtual ?? EloXp.CURIOSO,
      maiorElo: progresso?.maiorElo ?? EloXp.CURIOSO,
      ultimaAtividadeEm: progresso?.ultimaAtividadeEm ?? null,
      rebaixamentosAplicados: progresso?.rebaixamentosAplicados ?? 0,
    };
  }

  /**
   * Historico paginado de XP recebido, mais recente primeiro.
   *
   * @param usuarioId Id do usuario.
   * @param paginacao Parametros de paginacao (skip/take).
   * @returns Pagina de transacoes de XP e o total.
   */
  async listarHistoricoXp(
    usuarioId: string,
    paginacao: ParametrosPaginacao,
  ): Promise<{ data: TransacaoXpComTentativa[]; total: number }> {
    const where: Prisma.TransacaoXpWhereInput = { usuarioId };

    const [data, total] = await prisma.$transaction([
      prisma.transacaoXp.findMany({
        where,
        include: includeHistoricoXp,
        orderBy: { criadoEm: "desc" },
        skip: paginacao.skip,
        take: paginacao.limit,
      }),
      prisma.transacaoXp.count({ where }),
    ]);

    return { data, total };
  }
}
